/**
 * Quiz Timer Worker
 *
 * Processes time-based quiz lifecycle events scheduled as BullMQ delayed jobs:
 *   - CONTEST_START:   Transition waiting room → quiz for ready participants
 *   - TIME_WARNING:    Emit countdown warnings at configured intervals
 *   - AUTO_SUBMIT:     Force-submit all active participants at contest endTime
 *   - CAPTURE_REQUEST: Trigger identity audit snapshot for a participant
 *
 * Self-registers via workerRegistry.
 */

import { Worker as BullMQWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import type { Worker } from "./worker.interface";
import { quizTimerQueue } from "../queues";
import type { QuizTimerJobPayload } from "../queues";
import type { PrismaClient } from "@prisma/client";
import { QuizSession } from "../modules/quiz/quiz.session";
import { QuizSchedulerService } from "../modules/quiz/quiz-scheduler.service";
import { recordJobBoundary, CheckpointMeta } from "../common/job-checkpoint";

// Stateless — safe to instantiate directly rather than threading through the
// injection setter, which exists only to break the gateway/service import cycle.
const quizScheduler = new QuizSchedulerService();

// ─── Late-bound references ────────────────────────────────────────────────────
// The gateway and services are initialized in container.ts and injected at
// startup. We use a setter pattern to avoid circular dependencies.

let quizGateway: {
    startQuizForParticipant: (pid: string, cid: string, oid: string, contactId: string) => Promise<void>;
    emitTimeWarning: (cid: string, seconds: number) => void;
    emitAutoSubmit: (pid: string, cid: string, reason: string) => Promise<void>;
    emitCaptureRequest: (pid: string, captureType: string) => Promise<void>;
    broadcastAdminEvent: (cid: string, event: string, data: unknown) => void;
} | null = null;

let quizService: {
    transitionToQuiz: (cid: string) => Promise<{ transitioned: string[]; blocked: string[] }>;
    handleTimeExpiry: (cid: string) => Promise<{ submitted: string[]; errors: Array<{ participantId: string; error: string }> }>;
    handleRejoin: (cid: string, pid: string) => Promise<any | null>;
} | null = null;

let contestService: {
    triggerEvaluation: (cid: string, oid: string) => Promise<any>;
    declareResults: (cid: string, oid: string) => Promise<any>;
    runContestStartSequence: (cid: string, oid: string) => Promise<{ transitioned: string[]; blocked: string[] }>;
} | null = null;

let prisma: PrismaClient | null = null;

/** Called from container.ts to inject dependencies after initialization */
export function injectTimerWorkerDeps(deps: {
    gateway: typeof quizGateway;
    quizService: typeof quizService;
    contestService: typeof contestService;
    prismaClient: PrismaClient;
}): void {
    quizGateway = deps.gateway;
    quizService = deps.quizService;
    contestService = deps.contestService;
    prisma = deps.prismaClient;
}

// ─── Job Processor ────────────────────────────────────────────────────────────

async function processTimerJob(job: Job<QuizTimerJobPayload>): Promise<void> {
    const { contestId, organizationId, type } = job.data;

    logger.info(
        `[quiz-timer] Processing ${type} for contest ${contestId} (job ${job.id})`,
    );

    // Checkpoint identity — boundary-only (no per-stage withCheckpoint) since
    // this queue dispatches six structurally different event types and can
    // fire at meaningful volume (per-participant CAPTURE_REQUEST jobs); see
    // common/job-checkpoint.ts. entityType/entityId distinguish the event
    // kind in the Job Timeline UI without adding extra Redis writes per stage.
    const checkpointMeta: CheckpointMeta = {
        jobId: job.id ?? `${type}-${contestId}`,
        queue: "quiz-timer-queue",
        organizationId,
        contestId,
        entityType: type,
        entityId: job.data.participantId ?? contestId,
    };
    if (job.attemptsMade === 0) {
        recordJobBoundary(checkpointMeta, "STARTED", undefined, job.timestamp);
    }

    switch (type) {
        case "CONTEST_START":
            await handleContestStart(contestId, organizationId);
            break;

        case "TIME_WARNING":
            await handleTimeWarning(contestId, job.data.secondsRemaining ?? 0);
            break;

        case "AUTO_SUBMIT":
            await handleAutoSubmit(contestId, organizationId);
            break;

        case "CAPTURE_REQUEST":
            await handleCaptureRequest(job.data.participantId!, job.data.captureType!);
            break;

        case "MARK_ABSENT":
            await handleMarkAbsent(contestId, organizationId);
            break;

        case "AUTO_DECLARE_RESULTS":
            await handleAutoDeclareResults(contestId, organizationId);
            break;

        default:
            logger.warn(`[quiz-timer] Unknown job type: ${type}`);
    }

    recordJobBoundary(checkpointMeta, "COMPLETED");
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Guards a lifecycle job against a schedule that changed after the job was queued.
 *
 * An admin editing a contest's startTime/duration cancels and re-adds these jobs,
 * but that cancel is not guaranteed: BullMQ `add()` silently no-ops when a job with
 * the same jobId still exists, so a failed removal leaves the ORIGINAL job in place
 * with its ORIGINAL delay. It then fires at the old time and starts (or auto-submits)
 * the contest early — with no error anywhere.
 *
 * Rather than trusting queue state, every timer job re-reads the contest and checks
 * itself against the CURRENT scheduled time. If it woke up too early, it re-queues
 * itself for the correct moment and does nothing else. This makes the schedule
 * self-healing regardless of what the queue contains.
 *
 * @returns `true` if the job should proceed, `false` if it was stale and rescheduled.
 */
async function isDueOrReschedule(
    contestId: string,
    scheduledFor: Date,
    jobId: string,
    payload: QuizTimerJobPayload,
): Promise<boolean> {
    const toleranceMs = config.quiz.timerDriftTolerance * 1000;
    const earlyByMs = scheduledFor.getTime() - Date.now();

    if (earlyByMs <= toleranceMs) return true;

    logger.warn(
        `[quiz-timer] STALE ${payload.type} for contest ${contestId} — fired ` +
        `${Math.round(earlyByMs / 1000)}s before its current scheduled time ` +
        `(${scheduledFor.toISOString()}). The contest schedule was most likely edited ` +
        `after this job was queued. Re-scheduling and skipping this run.`,
    );

    try {
        const existing = await quizTimerQueue.getJob(jobId);
        if (existing) await existing.remove();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[quiz-timer] Could not remove stale job ${jobId}: ${msg}`);
    }

    await quizTimerQueue.add("quiz-timer", payload, {
        jobId,
        delay: earlyByMs,
        removeOnComplete: true,
        removeOnFail: { count: 100 },
    });

    return false;
}

async function handleContestStart(contestId: string, organizationId: string): Promise<void> {
    if (!contestService || !prisma) {
        logger.error(
            "[quiz-timer] CONTEST_START aborted — dependencies not injected. " +
            "Ensure worker.ts imports ./container before startWorkers().",
        );
        return;
    }

    // 0. Validate against the contest's CURRENT schedule before starting anything.
    //    Starting a contest early is unrecoverable for participants, so this check
    //    must happen before the status flips to LIVE.
    const scheduled = await prisma.contest.findUnique({
        where: { id: contestId },
        select: { startTime: true, status: true },
    });

    if (!scheduled) {
        logger.warn(`[quiz-timer] CONTEST_START aborted — contest ${contestId} not found`);
        return;
    }

    // LIVE is included alongside the terminal statuses: an admin's manual "Start Now"
    // may have already run this contest's start sequence (and evicted this job), but a
    // race where this job still fires afterwards must no-op rather than re-run it.
    if (scheduled.status === "CANCELLED" || scheduled.status === "COMPLETED" || scheduled.status === "LIVE") {
        logger.warn(
            `[quiz-timer] CONTEST_START aborted — contest ${contestId} is ${scheduled.status}`,
        );
        return;
    }

    const due = await isDueOrReschedule(contestId, scheduled.startTime, `start-${contestId}`, {
        contestId,
        organizationId,
        type: "CONTEST_START",
    });
    if (!due) return;

    // Steps 1–5 (status flip, transitionToQuiz, per-participant start, DB-fallback,
    // admin broadcast) live on ContestService — shared with the manual "Start Now"
    // override so the two triggers can never diverge. See contest.service.ts.
    const { transitioned, blocked } = await contestService.runContestStartSequence(contestId, organizationId);

    logger.info(
        `[quiz-timer] Contest ${contestId} started: ${transitioned.length} transitioned, ${blocked.length} blocked`,
    );
}

async function handleTimeWarning(contestId: string, secondsRemaining: number): Promise<void> {
    if (!quizGateway) return;
    quizGateway.emitTimeWarning(contestId, secondsRemaining);
    logger.info(`[quiz-timer] Time warning emitted for contest ${contestId}: ${secondsRemaining}s remaining`);
}

async function handleAutoSubmit(contestId: string, organizationId: string): Promise<void> {
    if (!quizService || !quizGateway) return;

    // Same staleness guard as CONTEST_START — a leftover job from a pre-edit
    // schedule would force-submit every active participant mid-quiz.
    if (prisma) {
        const scheduled = await prisma.contest.findUnique({
            where: { id: contestId },
            select: { endTime: true, status: true },
        });

        if (!scheduled) {
            logger.warn(`[quiz-timer] AUTO_SUBMIT aborted — contest ${contestId} not found`);
            return;
        }
        if (scheduled.status === "CANCELLED") {
            logger.warn(`[quiz-timer] AUTO_SUBMIT aborted — contest ${contestId} is CANCELLED`);
            return;
        }

        const due = await isDueOrReschedule(contestId, scheduled.endTime, `autosubmit-${contestId}`, {
            contestId,
            organizationId,
            type: "AUTO_SUBMIT",
        });
        if (!due) return;
    }

    const { submitted, errors } = await quizService.handleTimeExpiry(contestId);

    // Notify each submitted participant
    for (const pid of submitted) {
        await quizGateway.emitAutoSubmit(pid, contestId, "time_expired");
    }

    if (contestService) {
        try {
            await contestService.triggerEvaluation(contestId, organizationId);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(
                `[quiz-timer] Contest ${contestId} could not be moved to EVALUATION: ${msg}`
            );
        }
    }

    logger.info(
        `[quiz-timer] Auto-submit for contest ${contestId}: ${submitted.length} submitted, ${errors.length} errors`,
    );

    // Shared with the admin force-end path so the grace period cannot diverge.
    try {
        await quizScheduler.scheduleMarkAbsent(contestId, organizationId);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[quiz-timer] Failed to enqueue MARK_ABSENT job for contest ${contestId}: ${msg}`);
    }
}

async function handleCaptureRequest(participantId: string, captureType: string): Promise<void> {
    if (!quizGateway) return;
    await quizGateway.emitCaptureRequest(participantId, captureType);
    logger.info(`[quiz-timer] Capture request sent to ${participantId}: ${captureType}`);
}

async function handleMarkAbsent(contestId: string, organizationId: string): Promise<void> {
    if (!prisma) {
        logger.error("[quiz-timer] Prisma client not injected for MARK_ABSENT");
        return;
    }

    logger.info(`[quiz-timer] Starting MARK_ABSENT processing for contest ${contestId}`);

    try {
        // Fetch participant IDs currently in live Redis sets (waiting, active, submitted)
        const session = new QuizSession();
        const [waitingIds, activeIds, submittedIds] = await Promise.all([
            session.getSetMembers(contestId, "waiting"),
            session.getSetMembers(contestId, "active"),
            session.getSetMembers(contestId, "submitted"),
        ]);
        
        const activeOrSubmittedIds = new Set([
            ...waitingIds,
            ...activeIds,
            ...submittedIds
        ]);

        // 1. Query database participants who are still in pre-quiz status AND DO NOT have any submission record
        const participants = await prisma.participant.findMany({
            where: {
                contestId,
                organizationId,
                status: {
                    in: ["REGISTERED", "CHECKED_IN", "IN_WAITING"],
                },
                submission: {
                    is: null,
                },
            },
            select: { id: true },
        });

        // Filter out any participants who are active/submitted in Redis or have a submission record
        const filteredParticipants = participants.filter(
            (p) => !activeOrSubmittedIds.has(p.id)
        );
        const participantIds = filteredParticipants.map((p) => p.id);
        logger.info(`[quiz-timer] Found ${participants.length} candidates, narrowed to ${participantIds.length} truly absent participants after Redis & DB submission exclusion.`);

        if (participantIds.length === 0) {
            logger.info(`[quiz-timer] No absent participants to process for contest ${contestId}`);
            return;
        }

        // 2. Chunk into batches of 500
        const batchSize = 500;
        const delayMs = 50;

        for (let i = 0; i < participantIds.length; i += batchSize) {
            const batch = participantIds.slice(i, i + batchSize);

            // 3. Update each batch in a transaction
            await prisma.$transaction(
                async (tx) => {
                    await tx.participant.updateMany({
                        where: {
                            id: { in: batch },
                            status: {
                                in: ["REGISTERED", "CHECKED_IN", "IN_WAITING"],
                            },
                        },
                        data: { status: "ABSENT" },
                    });
                },
                {
                    timeout: 5000, // 5s timeout
                }
            );

            logger.info(`[quiz-timer] Updated batch of ${batch.length} participants to ABSENT`);

            // Invalidate Redis cache key after each batch commit
            const cacheKey = `contest:status-summary:${contestId}`;
            await redis.del(cacheKey);

            // 4. Inter-batch delay of 50ms to prevent DB index lock contention
            if (i + batchSize < participantIds.length) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }

        logger.info(`[quiz-timer] Completed MARK_ABSENT processing for contest ${contestId}`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[quiz-timer] Error in MARK_ABSENT for contest ${contestId}: ${msg}`);
        throw err;
    }
}

async function handleAutoDeclareResults(contestId: string, organizationId: string): Promise<void> {
    if (!contestService || !prisma) {
        logger.error("[quiz-timer] AUTO_DECLARE_RESULTS aborted — dependencies not injected.");
        return;
    }

    // Check if contest has already had results declared (idempotent guard)
    const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        select: { status: true },
    });

    if (!contest) {
        logger.warn(`[quiz-timer] AUTO_DECLARE_RESULTS: Contest ${contestId} not found — skipping.`);
        return;
    }

    if (["RESULTS_OUT", "COMPLETED", "CANCELLED"].includes(contest.status)) {
        logger.info(
            `[quiz-timer] AUTO_DECLARE_RESULTS: Contest ${contestId} already in ${contest.status} — no-op.`,
        );
        return;
    }

    try {
        await contestService.declareResults(contestId, organizationId);
        logger.info(`[quiz-timer] AUTO_DECLARE_RESULTS: Successfully declared results for contest ${contestId}.`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[quiz-timer] AUTO_DECLARE_RESULTS failed for contest ${contestId}: ${msg}`);
        throw err; // Let BullMQ retry
    }
}

// ─── Worker Registration ──────────────────────────────────────────────────────

export class QuizTimerWorker implements Worker {
    name = "quiz-timer-worker";
    private worker?: BullMQWorker<QuizTimerJobPayload>;

    start(): void {
        this.worker = new BullMQWorker<QuizTimerJobPayload>(
            "quiz-timer-queue",
            processTimerJob,
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: config.queue.concurrency,
            },
        );

        this.worker.on("completed", (job) => {
            logger.info(`[quiz-timer] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(
                `[quiz-timer] Job ${job?.id} failed: ${err.message}`,
            );

            if (job?.data) {
                recordJobBoundary(
                    {
                        jobId: job.id ?? `${job.data.type}-${job.data.contestId}`,
                        queue: "quiz-timer-queue",
                        organizationId: job.data.organizationId,
                        contestId: job.data.contestId,
                        entityType: job.data.type,
                        entityId: job.data.participantId ?? job.data.contestId,
                    },
                    "FAILED",
                    err.message
                );
            }
        });

        this.worker.on("error", (err) => {
            logger.error(`[quiz-timer] Worker error: ${err.message}`);
        });

        this.worker.on("ready", () => {
            logger.info(
                `[quiz-timer] Ready — concurrency: ${config.queue.concurrency}`,
            );
        });
    }
}

const quizTimerWorkerInstance = new QuizTimerWorker();
workerRegistry.register(quizTimerWorkerInstance);
