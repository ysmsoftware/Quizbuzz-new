/**
 * QuizService
 *
 * All live state (phase transitions, heartbeat, answers) is Redis-only.
 * The DB is NEVER written to during a live quiz — that is the analytics
 * worker's job (runs every N minutes via BullMQ).
 *
 * Engineering rule: stateless API instances, Redis = single source of truth
 * during contest execution.
 */

import { QuizSession } from "./quiz.session";
import { prisma } from "../../config/db";
import { redis } from "../../config/redis";
import logger from "../../config/logger";
import {
    QuizSessionState,
    QuizSubmitResult,
    SavedAnswer,
} from "./quiz.types";
import { ProctoringService } from "./proctoring.service";
import { SubmissionService } from "../submission/submission.service";
import { submissionQueue } from "../../queues";
import { buildSessionSeed, shuffleQuestionsForParticipant } from "../question/question.shuffle";
import { QuizSchedulerService } from "./quiz-scheduler.service";
import { DurabilityService } from "../durability/durability.service";
import { config } from "../../config";

export class QuizService {
    constructor(
        private session: QuizSession,
        private proctoring: ProctoringService,
        private submissionService: SubmissionService,
        private scheduler: QuizSchedulerService,
        private durability: DurabilityService,
    ) { }

    // ─────────────────────────────────────────────────────────────────────────
    // WAITING ROOM
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Called when a participant socket connects and joins the waiting room.
     * Stores their name in Redis meta so the live snapshot never needs the DB.
     * No DB writes — Redis only.
     */
    async joinWaitingRoom(
        contestId: string,
        participantId: string,
        participantName?: string,
        contactId?: string,
    ): Promise<{ participantCount: number; status: string }> {
        logger.info(`[QuizService] Participant ${participantId} joining waiting room for contest ${contestId}`);

        // ── Check 1: Redis session hash exists (hot path) ──────────────────────────────
        const existingSession = await this.session.getSession(contestId, participantId);
        if (existingSession) {
            const phase = existingSession.phase;
            if (phase === "SUBMITTED") {
                return { participantCount: 0, status: "SUBMITTED" };
            }
            if (phase === "IN_QUIZ" || phase === "DISCONNECTED") {
                await this.session.markReconnected(contestId, participantId, "IN_QUIZ");
                return {
                    participantCount: await this.session.getWaitingCount(contestId),
                    status: "IN_QUIZ",
                };
            }
        }

        // ── Check 2: Redis SET membership (handles session-hash TTL expiry) ──────────────
        // IMPORTANT: markDisconnected moves participants from `active` → `disconnected`.
        // We MUST check BOTH sets, not just `active`.
        const [inActive, inSubmitted, inDisconnected] = await Promise.all([
            redis.sismember(`quiz:${contestId}:active`, participantId),
            redis.sismember(`quiz:${contestId}:submitted`, participantId),
            redis.sismember(`quiz:${contestId}:disconnected`, participantId),
        ]);

        if (inSubmitted) {
            return { participantCount: 0, status: "SUBMITTED" };
        }

        if (inActive || inDisconnected) {
            // Participant was in-quiz and either still active or disconnected mid-quiz.
            // Either way, treat as IN_QUIZ reconnect — rebuild session if hash expired.
            logger.info(
                `[QuizService] Reconnecting IN_QUIZ participant ${participantId} ` +
                `(inActive=${!!inActive}, inDisconnected=${!!inDisconnected})`
            );
            let rebuiltOk = true;
            if (!existingSession) {
                // Session hash expired — rebuild from DB so handleRejoin can serve questions.
                // rebuildExpiredSession() refuses (returns false) if the contest isn't
                // actually LIVE — defense in depth against stale/incorrect SET membership
                // ever fabricating a live quiz session before start time.
                rebuiltOk = await this.rebuildExpiredSession(contestId, participantId, contactId ?? "", participantName ?? "Participant");
            }
            if (rebuiltOk) {
                await this.session.markReconnected(contestId, participantId, "IN_QUIZ");
                return {
                    participantCount: await this.session.getWaitingCount(contestId),
                    status: "IN_QUIZ",
                };
            }
            // Rebuild was refused — the active/disconnected membership was stale
            // or pointed at a contest that isn't LIVE. Clear it so this participant
            // doesn't hit the same dead-end on every future join attempt, and fall
            // through to the normal join flow below (which re-derives the correct
            // status, including START_IMMEDIATELY if the contest is genuinely LIVE).
            logger.warn(
                `[QuizService] IN_QUIZ reconnect refused for ${participantId} in contest ${contestId} — ` +
                `clearing stale active/disconnected membership and falling back to normal join`
            );
            await Promise.all([
                redis.srem(`quiz:${contestId}:active`, participantId),
                redis.srem(`quiz:${contestId}:disconnected`, participantId),
            ]);
        }

        // ── Check 3: DB fallback (Redis TTL fully expired AND sets cleared) ────────────
        // The participant DB record is the authoritative source of truth.
        try {
            const dbParticipant = await prisma.participant.findUnique({
                where: { id: participantId },
                select: { status: true, contactId: true, organizationId: true },
            });
            if (dbParticipant?.status === "IN_QUIZ") {
                logger.info(
                    `[QuizService] DB fallback: participant ${participantId} status=IN_QUIZ — rebuilding session`
                );
                const rebuiltOk = await this.rebuildExpiredSession(
                    contestId, participantId,
                    dbParticipant.contactId || contactId || "",
                    participantName ?? "Participant",
                );
                if (rebuiltOk) {
                    await this.session.markReconnected(contestId, participantId, "IN_QUIZ");
                    return {
                        participantCount: await this.session.getWaitingCount(contestId),
                        status: "IN_QUIZ",
                    };
                }
                // DB says IN_QUIZ but the contest itself isn't LIVE (stale/incorrect
                // Participant.status row) — don't trust it. Fall through to the
                // normal join flow below instead of handing out a live session.
                logger.warn(
                    `[QuizService] DB fallback refused IN_QUIZ rebuild for ${participantId} — ` +
                    `contest ${contestId} is not LIVE; falling back to normal join`
                );
            }
        } catch (err) {
            logger.warn(`[QuizService] DB fallback check failed for ${participantId}: ${(err as Error).message}`);
        }

        // ── Normal path: first join or clean waiting-room rejoin ────────────────────────
        if (participantName || contactId) {
            await this.session.setParticipantMeta(contestId, participantId, {
                name: participantName ?? "Participant",
                contactId: contactId ?? "",
            });
        }

        await this.session.addToWaitingRoom(contestId, participantId);
        await this.session.updatePhase(contestId, participantId, "WAITING");

        // Auto-grant camera readiness for non-proctored contests so participants
        // (and k6 load-test VUs, which have no camera) aren't stuck on the gate.
        // Only the per-contest flag controls this — not the global ENABLE_PROCTORING.
        const contestProctoringEnabled = await this.getContestProctoringEnabled(contestId);
        if (!contestProctoringEnabled) {
            await this.session.setReadiness(contestId, participantId, "camera", true);
        }

        // ── LIVE CONTEST FAST-PATH ────────────────────────────────────────────────────
        // If the contest is already LIVE when this participant joins, they should
        // start immediately rather than waiting for the next CONTEST_START BullMQ job
        // (which already fired once at startTime and won't fire again).
        // Return START_IMMEDIATELY so handleJoin in the gateway calls
        // startQuizForParticipant() directly, bypassing the waiting room entirely.
        try {
            const liveContest = await prisma.contest.findUnique({
                where: { id: contestId },
                select: { status: true },
            });
            if (liveContest?.status === "LIVE") {
                const count = await this.session.getWaitingCount(contestId);
                return { participantCount: count, status: "START_IMMEDIATELY" };
            }
        } catch (err) {
            logger.warn(`[QuizService] Live-status check failed for ${participantId}: ${(err as Error).message}`);
        }

        const count = await this.session.getWaitingCount(contestId);
        return { participantCount: count, status: "WAITING" };
    }

    async getWaitingCount(contestId: string): Promise<number> {
        return this.session.getWaitingCount(contestId);
    }

    private async getContestProctoringEnabled(contestId: string): Promise<boolean> {
        const contest = await prisma.contest.findUnique({
            where: { id: contestId },
            select: { proctoringEnabled: true },
        });
        return contest?.proctoringEnabled ?? true;
    }

    /**
     * Rebuild a minimal Redis session for a participant whose session TTL expired
     * while they were in-quiz. Fetches organizationId + contactId from DB (one read).
     * The full question shuffle is deterministic from the seed, so no answers are lost.
     *
     * Returns false (and creates nothing) if the participant can't be found, or if
     * the contest isn't actually LIVE — this is the last line of defense against
     * ever fabricating an IN_QUIZ session before a contest has started, regardless
     * of what the caller's Redis SET membership / DB status snapshot claimed.
     */
    private async rebuildExpiredSession(
        contestId: string,
        participantId: string,
        contactId: string,
        name: string,
    ): Promise<boolean> {
        // Fetch the minimal DB context needed to reconstruct the session
        const participant = await prisma.participant.findUnique({
            where: { id: participantId },
            select: {
                organizationId: true,
                contactId: true,
                contest: {
                    select: {
                        status: true,
                        endTime: true,
                        duration: true,
                    },
                },
            },
        });

        if (!participant) {
            logger.warn(`[QuizService] Cannot rebuild session: participant ${participantId} not found in DB`);
            return false;
        }

        if (participant.contest?.status !== "LIVE") {
            logger.warn(
                `[QuizService] Refused to rebuild IN_QUIZ session for ${participantId} — ` +
                `contest ${contestId} status is "${participant.contest?.status}", not LIVE`
            );
            return false;
        }

        const sessionSeed = buildSessionSeed(participantId, contestId);
        const resolvedContactId = participant.contactId || contactId;

        await Promise.all([
            this.session.createSession({
                contestId,
                participantId,
                organizationId: participant.organizationId,
                contactId: resolvedContactId,
                socketId: "reconnected",
                phase: "IN_QUIZ",
                seed: sessionSeed,
                startedAt: new Date().toISOString(), // approximate — answers are preserved in Redis
                currentQuestion: 0,                        // handleRejoin will use savedAnswers count
                totalQuestions: 0,                        // filled by handleRejoin from DB
                contestEndTime: participant.contest?.endTime?.toISOString() ?? "",
                violationCount: 0,
                lastHeartbeatAt: new Date().toISOString(),
            }),
            this.session.setParticipantMeta(contestId, participantId, {
                name: name,
                contactId: resolvedContactId,
            }),
        ]);

        logger.info(`[QuizService] Rebuilt expired session for participant ${participantId}`);
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HEARTBEAT
    // ─────────────────────────────────────────────────────────────────────────

    async handleHeartbeat(contestId: string, participantId: string): Promise<void> {
        await this.session.refreshHeartbeat(contestId, participantId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // START QUIZ
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Transitions participant from WAITING → IN_QUIZ.
     * Fetches questions from DB once per participant start (acceptable — it's
     * a single CONTEST_QUESTIONS read, not a state write).
     * All subsequent operations are Redis-only.
     */
    async startQuiz(
        contestId: string,
        organizationId: string,
        participantId: string,
        contactId: string,
        socketId: string,
        participantName?: string,
    ): Promise<{ questions: any[]; totalTimeMs: number; serverTimestamp: string }> {
        // Transition Redis sets (no DB)
        await Promise.all([
            this.session.updatePhase(contestId, participantId, "IN_QUIZ"),
            this.session.addToActive(contestId, participantId),  // also removes from waiting internally
        ]);

        // Ensure meta exists (may already be set from joinWaitingRoom)
        if (participantName) {
            await this.session.setParticipantMeta(contestId, participantId, {
                name: participantName,
                contactId: contactId,
            });
        }

        // Single DB read: fetch questions (read-only, not a state write)
        const contest = await prisma.contest.findUnique({
            where: { id: contestId },
            select: {
                shuffleQuestions: true,
                shuffleOptions: true,
                duration: true,
                endTime: true,
                questions: {
                    orderBy: { position: "asc" },
                    include: {
                        question: {
                            include: {
                                options: {
                                    select: { id: true, text: true, position: true, isCorrect: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!contest) throw new Error(`[quiz-service] Contest ${contestId} not found`);

        const sessionSeed = buildSessionSeed(participantId, contestId);
        const shuffled = shuffleQuestionsForParticipant(
            contest.questions,
            sessionSeed,
            contest.shuffleQuestions,
            contest.shuffleOptions,
        );

        // Time budget = the participant's full duration, but never beyond the
        // contest's hard endTime. Without the clamp a participant who starts even
        // slightly early/late gets a full `duration` window measured from their own
        // start, which can run past endTime — the AUTO_SUBMIT job then cuts them off
        // mid-quiz while their on-screen timer still shows time left.
        const fullDurationMs = (contest.duration ?? 60) * 60 * 1000;
        const msUntilContestEnd = contest.endTime.getTime() - Date.now();
        const totalTimeMs = Math.max(0, Math.min(fullDurationMs, msUntilContestEnd));

        // Write full session state to Redis
        await this.session.createSession({
            contestId,
            participantId,
            organizationId,
            contactId,
            socketId,
            phase: "IN_QUIZ",
            seed: sessionSeed,
            startedAt: new Date().toISOString(),
            currentQuestion: 0,
            totalQuestions: shuffled.questions.length,
            contestEndTime: contest.endTime.toISOString(),
            violationCount: 0,
            lastHeartbeatAt: new Date().toISOString(),
        });

        await this.session.saveQuestionOrder(contestId, participantId, shuffled.questions.map(q => q.id));

        // Schedule proctoring snapshot captures async (fire-and-forget)
        this.scheduler.scheduleSnapshotCaptures(contestId, organizationId, participantId, totalTimeMs)
            .catch(err => logger.error(`[QuizService] Failed to schedule snapshots for ${participantId}:`, err));

        return {
            questions: shuffled.questions,
            totalTimeMs,
            serverTimestamp: new Date().toISOString(),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SAVE ANSWER
    // ─────────────────────────────────────────────────────────────────────────

    async saveAnswer(
        contestId: string,
        participantId: string,
        questionId: string,
        selectedOptionId: string | null,
        selectedOptionText: string | null,
        answeredAt: string,
    ): Promise<boolean> {
        const state = await this.session.getSession(contestId, participantId);
        if (state?.phase !== "IN_QUIZ") return false;

        const normalizedOptionId = (selectedOptionId === "" || selectedOptionId === null || selectedOptionId === undefined) ? null : selectedOptionId;
        const normalizedOptionText = (normalizedOptionId === null) ? null : selectedOptionText;

        await this.session.saveAnswer(contestId, participantId, questionId, {
            selectedOptionId: normalizedOptionId,
            selectedOptionText: normalizedOptionText,
            answeredAt,
        });
        return true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SUBMIT QUIZ
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Final submission.
     * 1. Read answers + question order from Redis
     * 2. Fill in null entries for every question NOT in the answers hash
     *    (these are skipped questions — the participant never touched them)
     * 3. Transition Redis state → SUBMITTED
     * 4. Enqueue BullMQ job → submission worker handles DB persistence
     */
    async submitQuiz(
        contestId: string,
        participantId: string,
        reason: "MANUAL" | "AUTO" | "TIMEOUT",
    ): Promise<QuizSubmitResult> {
        const gotLock = await this.session.acquireSubmissionLock(
            contestId, participantId, config.quiz.submissionLockTtlMs
        );

        if (!gotLock) {
            // Someone else (manual submit racing AUTO_SUBMIT, or a flaky-Redis
            // recovery racing a live submission) is already submitting this
            // participant right now. Give it a short grace window to finish
            // and report its result instead of racing a second submission job.
            logger.warn(`[quiz-service] submitQuiz already in flight for participant ${participantId} — waiting instead of racing`);
            return this.waitForInFlightSubmission(contestId, participantId);
        }

        try {
            return await this.doSubmitQuiz(contestId, participantId, reason);
        } finally {
            await this.session.releaseSubmissionLock(contestId, participantId);
        }
    }

    private async waitForInFlightSubmission(contestId: string, participantId: string): Promise<QuizSubmitResult> {
        const jobId = `${participantId}-${contestId}`;
        const attempts = 4;
        const delayMs = 400;

        // Poll for the persisted row on every attempt, regardless of whether the
        // lock has cleared yet. The lock releases as soon as the winning call
        // finishes enqueueing the BullMQ job — well before the submission worker
        // has actually picked it up and written the DB row, since that persist
        // happens asynchronously. Checking only once, right when the lock first
        // clears, and giving up immediately if the row isn't there yet (the
        // previous behaviour) meant this almost always returned a false
        // zero-answer result even though the real submission was seconds away
        // from succeeding. Only give up after every attempt is exhausted.
        for (let i = 0; i < attempts; i++) {
            await new Promise(resolve => setTimeout(resolve, delayMs));

            const existing = await prisma.submission.findUnique({ where: { participantId } });
            if (existing) {
                return {
                    submissionRef: existing.id,
                    timeTakenSecs: existing.timeTakenSecs ?? 0,
                    totalQuestions: existing.totalQuestions ?? 0,
                    attempted: existing.attempted ?? 0,
                };
            }
        }

        logger.warn(`[quiz-service] Timed out waiting for in-flight submission for participant ${participantId} — returning best-effort result`);
        return { submissionRef: jobId, timeTakenSecs: 0, totalQuestions: 0, attempted: 0 };
    }

    private async doSubmitQuiz(
        contestId: string,
        participantId: string,
        reason: "MANUAL" | "AUTO" | "TIMEOUT",
    ): Promise<QuizSubmitResult> {
        const [answers, state, questionOrder] = await Promise.all([
            this.session.getAllAnswers(contestId, participantId),
            this.session.getSession(contestId, participantId),
            this.session.getQuestionOrder(contestId, participantId),
        ]);

        if (!state) {
            const recovered = await this.durability.rehydrateParticipant(contestId, participantId);

            if (recovered) {
                logger.warn(
                    `[quiz-service] Session expired for participant ${participantId} in contest ${contestId} — ` +
                    `recovered ${recovered.attempted}/${recovered.totalQuestions} answers from progress snapshot`
                );
                const jobId = `${participantId}-${contestId}`;
                // Anchor to the earlier of "now" and the contest's actual end time —
                // recovery can run well after the participant's session went missing
                // (whenever submitQuiz() next gets called for them), so anchoring to
                // raw Date.now() would count the entire outage/recovery-delay window
                // as quiz-taking time and inflate timeTakenSecs (which feeds
                // leaderboard display/tie-breaking).
                const recoveryAnchorMs = recovered.contestEndTime
                    ? Math.min(Date.now(), new Date(recovered.contestEndTime).getTime())
                    : Date.now();
                const recoveredTimeTakenMs = recovered.startedAt
                    ? Math.max(0, recoveryAnchorMs - new Date(recovered.startedAt).getTime())
                    : 0;
                await submissionQueue.add(
                    "persist-submission",
                    {
                        organizationId: recovered.organizationId,
                        participantId,
                        contestId,
                        submittedAt: new Date().toISOString(),
                        timeTakenSecs: recoveredTimeTakenMs / 1000,
                        timeTakenMs: recoveredTimeTakenMs,
                        source: "RECOVERED",
                        totalQuestions: recovered.totalQuestions,
                        attempted: recovered.attempted,
                        joinedAt: recovered.startedAt,
                        answers: recovered.answersArray,
                    },
                    { jobId }
                );
                await this.session.addToSubmitted(contestId, participantId).catch(() => {
                    // Redis may still be unavailable here — non-fatal, the DB write is what matters.
                });
                return {
                    submissionRef: jobId,
                    timeTakenSecs: recoveredTimeTakenMs / 1000,
                    totalQuestions: recovered.totalQuestions,
                    attempted: recovered.attempted,
                };
            }

            logger.warn(
                `[quiz-service] Session expired for participant ${participantId} in contest ${contestId} — enqueueing zero-answer submission`
            );
            const fallbackJobId = `fallback-${participantId}-${contestId}`;
            await submissionQueue.add(
                "persist-submission",
                {
                    organizationId: "",
                    participantId,
                    contestId,
                    submittedAt: new Date().toISOString(),
                    timeTakenSecs: 0,
                    timeTakenMs: 0,
                    source: reason === "MANUAL" ? "MANUAL" : "AUTO",
                    totalQuestions: 0,
                    attempted: 0,
                    // No Redis session existed (expired/never started) — joinedAt stays unset.
                    joinedAt: null,
                    answers: [],
                },
                { jobId: fallbackJobId }
            );
            await this.session.addToSubmitted(contestId, participantId);
            return { submissionRef: fallbackJobId, timeTakenSecs: 0, totalQuestions: 0, attempted: 0 };
        }

        // Transition Redis sets (no DB write)
        await this.session.addToSubmitted(contestId, participantId);
        await this.session.updatePhase(contestId, participantId, "SUBMITTED");

        // Build a complete answer array covering EVERY question in the participant's
        // shuffled order. Questions the participant never touched get selectedOptionId=null
        // so the submission worker writes them as Answer rows and the evaluation worker
        // counts them as skipped rather than ignoring them.
        const answeredMap: Record<string, string | null> = {};
        for (const [questionId, answer] of Object.entries(answers)) {
            const optId = (answer as SavedAnswer).selectedOptionId;
            answeredMap[questionId] = (optId === "" || optId === null || optId === undefined) ? null : optId;
        }

        // Use question order from Redis if available; fall back to just the answered keys
        const orderedQuestionIds = questionOrder ?? Object.keys(answeredMap);

        const answersArray = orderedQuestionIds.map((questionId) => ({
            questionId,
            // null here means skipped — participant never selected an option for this question
            selectedOptionId: answeredMap[questionId] ?? null,
        }));

        const timeTakenMs = Date.now() - new Date(state.startedAt).getTime();
        const timeTakenSecs = timeTakenMs / 1000;
        const attemptedCount = answersArray.filter(a => a.selectedOptionId !== null).length;
        const jobId = `${participantId}-${contestId}`;

        await submissionQueue.add(
            "persist-submission",
            {
                organizationId: state.organizationId,
                participantId,
                contestId,
                submittedAt: new Date().toISOString(),
                timeTakenSecs,
                timeTakenMs,
                source: reason === "MANUAL" ? "MANUAL" : "AUTO",
                totalQuestions: orderedQuestionIds.length,
                attempted: attemptedCount,
                // Same moment already used above for timeTakenMs — passed through so
                // the submission worker can persist Participant.joinedAt.
                joinedAt: state.startedAt,
                answers: answersArray,
            },
            { jobId }
        );

        logger.info(`[quiz-service] Submission enqueued for participant ${participantId} — total=${orderedQuestionIds.length} attempted=${attemptedCount} skipped=${orderedQuestionIds.length - attemptedCount}`);

        return {
            submissionRef: jobId,
            timeTakenSecs,
            totalQuestions: orderedQuestionIds.length,
            attempted: attemptedCount,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DISCONNECT / RECONNECT
    // ─────────────────────────────────────────────────────────────────────────

    async handleDisconnect(contestId: string, participantId: string): Promise<void> {
        await this.session.markDisconnected(contestId, participantId);
        logger.info(`[QuizService] Participant ${participantId} marked disconnected`);
    }

    async handleRejoin(contestId: string, participantId: string): Promise<any | null> {
        const state = await this.session.getSession(contestId, participantId);
        if (!state) return null;

        // Restore set membership
        await this.session.markReconnected(contestId, participantId, state.phase);

        const answers = await this.session.getAllAnswers(contestId, participantId);

        // DB read — acceptable on reconnect (not a hot path)
        const contest = await prisma.contest.findUnique({
            where: { id: contestId },
            select: {
                shuffleQuestions: true,
                shuffleOptions: true,
                duration: true,
                endTime: true,
                questions: {
                    orderBy: { position: "asc" },
                    include: {
                        question: {
                            include: {
                                options: {
                                    select: { id: true, text: true, position: true, isCorrect: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!contest) return null;

        const sessionSeed = buildSessionSeed(participantId, contestId);
        const shuffled = shuffleQuestionsForParticipant(
            contest.questions, sessionSeed, contest.shuffleQuestions, contest.shuffleOptions,
        );

        // Patch totalQuestions in Redis if session was rebuilt with 0 (TTL-expired rebuild)
        if (state.totalQuestions === 0 && shuffled.questions.length > 0) {
            await redis.hset(
                `quiz:${contestId}:session:${participantId}`,
                "totalQuestions",
                String(shuffled.questions.length),
            );
        }

        const answeredCount = Object.keys(answers).length;

        return {
            phase: state.phase,
            questions: shuffled.questions,
            savedAnswers: answers,
            // Use contestEndTime for accurate remaining time; fall back to duration
            remainingTimeMs: state.contestEndTime
                ? Math.max(0, new Date(state.contestEndTime).getTime() - Date.now())
                : (contest.duration ?? 60) * 60 * 1000,
            currentQuestionIndex: answeredCount,  // resume from last answered + 1
            serverTimestamp: new Date().toISOString(),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BULK TRANSITIONS (called by timer worker)
    // ─────────────────────────────────────────────────────────────────────────

    async transitionToQuiz(contestId: string): Promise<{ transitioned: string[]; blocked: string[] }> {
        const waitingIds = await this.session.getSetMembers(contestId, "waiting");
        return { transitioned: waitingIds, blocked: [] };
    }

    async handleTimeExpiry(contestId: string): Promise<{ submitted: string[]; errors: any[] }> {
        // Submit ALL participants who were in-quiz at time expiry:
        // - active SET: currently connected participants
        // - disconnected SET: participants who lost connection mid-quiz
        //   (their answers are preserved in Redis — submitQuiz reads them)
        // We must cover both sets because OOM crashes / network drops move
        // participants from active → disconnected without submitting them.
        const [activeIds, disconnectedIds] = await Promise.all([
            this.session.getSetMembers(contestId, "active"),
            this.session.getSetMembers(contestId, "disconnected"),
        ]);

        // Deduplicate in case a participant appears in both (race condition)
        const allIds = [...new Set([...activeIds, ...disconnectedIds])];

        logger.info(
            `[quiz-service] handleTimeExpiry: ${activeIds.length} active + ` +
            `${disconnectedIds.length} disconnected = ${allIds.length} total to submit`
        );

        const submitted: string[] = [];
        const errors: any[] = [];

        // Process concurrently in batches of 50 to avoid overwhelming Redis
        const BATCH = 50;
        for (let i = 0; i < allIds.length; i += BATCH) {
            const batch = allIds.slice(i, i + BATCH);
            await Promise.allSettled(
                batch.map(async (pid) => {
                    try {
                        await this.submitQuiz(contestId, pid, "TIMEOUT");
                        submitted.push(pid);
                    } catch (err) {
                        errors.push({ participantId: pid, error: String(err) });
                    }
                })
            );
        }
        return { submitted, errors };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTIVE DEVICE TRACKING (single-device enforcement)
    // ─────────────────────────────────────────────────────────────────────────

    async getActiveDevice(contestId: string, participantId: string) {
        return this.session.getActiveDevice(contestId, participantId);
    }

    async setActiveDevice(contestId: string, participantId: string, deviceId: string, socketId: string) {
        return this.session.setActiveDevice(contestId, participantId, deviceId, socketId);
    }

    async clearActiveDeviceIfMatch(contestId: string, participantId: string, socketId: string) {
        return this.session.clearActiveDeviceIfMatch(contestId, participantId, socketId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PARTICIPANT PROGRESS
    // ─────────────────────────────────────────────────────────────────────────

    async getParticipantProgress(contestId: string, participantId: string) {
        const [state, answers] = await Promise.all([
            this.session.getSession(contestId, participantId),
            this.session.getAllAnswers(contestId, participantId),
        ]);
        return {
            currentQuestionIndex: state?.currentQuestion ?? 0,
            answeredCount: Object.keys(answers).length,
            totalQuestions: state?.totalQuestions ?? 0,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN LIVE SNAPSHOT  — pure Redis, zero DB, 2 round-trips
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns live contest state entirely from Redis.
     *
     * Performance at 10k users:
     *   Round-trip 1 : 4× SCARD + 3× SMEMBERS in one pipeline   → O(1) per set
     *   Round-trip 2 : 4× Redis commands per participant          → O(N) one pipeline
     *   Total DB queries: 0
     *   Total Redis round-trips: 2 (regardless of N)
     */
    async getAdminLiveSnapshot(contestId: string, _organizationId: string) {
        const threshold = config.proctoring.threshold;

        const { counts, participants } = await this.session.getLiveSnapshot(
            contestId,
            threshold,
        );

        const totalViolations = participants.reduce((sum, p) => sum + p.violationCount, 0);
        const totalFlagged = participants.filter(p => p.isFlagged).length;

        // Fetch recent 50 violations (excluding audit snapshots)
        const recentEvents = await prisma.proctoringEvent.findMany({
            where: {
                contestId,
                type: {
                    notIn: [
                        "SNAPSHOT_START",
                        "SNAPSHOT_MID_POINT",
                        "SNAPSHOT_RANDOM",
                        "SNAPSHOT_PRE_SUBMIT",
                    ] as any[],
                },
            },
            take: 50,
            orderBy: { occurredAt: "desc" },
            include: {
                participant: {
                    select: {
                        id: true,
                        contact: {
                            select: { firstName: true, lastName: true },
                        },
                    },
                },
            },
        });

        return {
            contestId,
            timestamp: new Date().toISOString(),
            // Set-level counts (directly from Redis SCARD)
            waiting: counts.waiting,
            active: counts.active,
            totalWaiting: counts.waiting,
            totalInQuiz: counts.active,
            totalSubmitted: counts.submitted,
            totalDisconnected: counts.disconnected,
            totalFlagged,
            totalViolations,
            // Per-participant rows (from pipelined HGETALL)
            participants: participants.map(p => ({
                participantId: p.participantId,
                name: p.name,
                status: p.phase,           // phase is the live truth
                currentQuestionIndex: p.currentQuestionIndex,
                totalQuestions: p.totalQuestions,
                answeredCount: p.answeredCount,
                violationCount: p.violationCount,
                trustScore: p.trustScore,
                isFlagged: p.isFlagged,
                lastActivityAt: p.lastActivityAt,
                isAlive: p.isAlive,
            })),
            violations: recentEvents.map(e => ({
                id: e.id,
                participantId: e.participantId,
                name: e.participant
                    ? [e.participant.contact.firstName, e.participant.contact.lastName].filter(Boolean).join(" ").trim()
                    : "Participant",
                type: e.type,
                severity: e.severity,
                timestamp: e.occurredAt.toISOString(),
            })),
        };
    }
}
