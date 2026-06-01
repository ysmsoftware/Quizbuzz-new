import { NotFoundError, BadRequestError, ConflictError } from "../../error/http-errors";
import { SubmissionRepository } from "./submission.repository";
import { ParticipantRepository } from "../participant/participant.repository";
import { ContestRepository } from "../contest/contest.repository";
import { SubmissionStatus, ContestStatus, ParticipantStatus } from "@prisma/client";
import { prisma } from "../../config/db";
import {
    ApplyEvaluationInput,
    CreateSubmissionInput,
    EvaluationJobPayload,
    ListSubmissionsFilter,
    PaginatedSubmissions,
    SubmissionDetail,
    SubmissionStatusCounts,
} from "./submission.types";
import { SubmitSubmissionInput } from "./submission.validator";
import { evaluationQueue } from "../../queues";
import logger from "../../config/logger";

export class SubmissionService {
    constructor(
        private readonly submissionRepo: SubmissionRepository,
        private readonly participantRepo: ParticipantRepository,
        private readonly contestRepo: ContestRepository,
    ) { }

    // ── Internal — called by workers only ─────────────────────────────────────

    /**
     * Persists a queued submission payload to the database.
     * Called by submission.worker after it dequeues a SubmissionJobPayload.
     *
     * Idempotent: if a submission already exists for this participant, the
     * existing submissionId is returned so the worker can still enqueue
     * evaluation without creating a duplicate.
     */
    async persistSubmission(input: CreateSubmissionInput): Promise<{ submissionId: string, organizationId: string }> {
        // Resolve organizationId from DB if not supplied (fallback submission path)
        let organizationId = input.organizationId;
        if (!organizationId) {
            const p = await prisma.participant.findUnique({
                where: { id: input.participantId },
                select: { organizationId: true },
            });
            if (!p) throw new Error(`[SubmissionService] Cannot resolve organizationId: participant ${input.participantId} not found`);
            organizationId = p.organizationId;
        }

        const resolvedInput = { ...input, organizationId };

        const alreadyExists = await this.submissionRepo.existsForParticipant(
            resolvedInput.organizationId,
            resolvedInput.participantId
        );

        if (alreadyExists) {
            logger.warn(
                `[SubmissionService.persistSubmission] Duplicate for participant ${resolvedInput.participantId} — returning existing`
            );
            const existing = await this.submissionRepo.findByParticipantId(
                resolvedInput.organizationId,
                resolvedInput.participantId
            );
            return { submissionId: existing!.id, organizationId };
        }

        const submission = await this.submissionRepo.createWithAnswers(resolvedInput);

        logger.info(
            `[SubmissionService.persistSubmission] Persisted ${submission.id} for participant ${resolvedInput.participantId}`
        );

        return { submissionId: submission.id, organizationId };
    }

    /**
     * Writes scored results back to Submission + Answer rows.
     * Called by evaluation.worker after the scoring pass.
     * Skips silently if already evaluated (worker retry safety).
     */
    async applyEvaluationResult(
        organizationId: string,
        submissionId: string,
        input: ApplyEvaluationInput
    ): Promise<void> {
        const exists = await this.submissionRepo.findById(organizationId, submissionId);
        if (!exists) {
            throw new NotFoundError(`Submission ${submissionId} not found during evaluation`);
        }
        if (exists.status === "EVALUATED") {
            logger.warn(
                `[SubmissionService.applyEvaluationResult] ${submissionId} already EVALUATED — skipping`
            );
            return;
        }

        await this.submissionRepo.applyEvaluationResult(organizationId, submissionId, input);

        logger.info(
            `[SubmissionService.applyEvaluationResult] ${submissionId} evaluated — score: ${input.score}`
        );
    }

    /**
     * Enqueues a single evaluation job.
     * jobId = submissionId guarantees BullMQ deduplication across retries.
     */
    async enqueueEvaluation(payload: EvaluationJobPayload): Promise<void> {
        await evaluationQueue.add("evaluate-submission", payload, {
            jobId: payload.submissionId,
        });

        logger.info(
            `[SubmissionService.enqueueEvaluation] Queued evaluation job for submission ${payload.submissionId}`
        );
    }

    /**
     * Returns all SUBMITTED (unevaluated) submissions for a contest.
     * Used by evaluation.worker for bulk evaluation pass.
     */
    async getPendingEvaluations(
        organizationId: string,
        contestId: string
    ): Promise<Array<{ id: string; participantId: string }>> {
        return this.submissionRepo.findPendingEvaluation(organizationId, contestId);
    }

    // ── Admin — HTTP routes ───────────────────────────────────────────────────

    async getSubmissionById(
        organizationId: string,
        submissionId: string
    ): Promise<SubmissionDetail> {
        const submission = await this.submissionRepo.findById(organizationId, submissionId);
        if (!submission) throw new NotFoundError("Submission not found");
        return submission;
    }

    async countByContest(contestId: string, organizationId: string, statuses: SubmissionStatus[]): Promise<number> {
        return this.submissionRepo.countByContest(organizationId, contestId, statuses);
    }

    async getContestSubmissions(
        organizationId: string,
        contestId: string,
        filter: ListSubmissionsFilter
    ): Promise<PaginatedSubmissions> {
        const { rows, total } = await this.submissionRepo.findByContestId(
            organizationId,
            contestId,
            filter
        );
        return {
            data: rows,
            pagination: {
                page: filter.page,
                limit: filter.limit,
                total,
                totalPages: Math.ceil(total / filter.limit),
            },
        };
    }

    async getContactSubmissions(
        organizationId: string,
        contactId: string,
        filter: ListSubmissionsFilter
    ): Promise<PaginatedSubmissions> {
        const { rows, total } = await this.submissionRepo.findByContactId(
            organizationId,
            contactId,
            filter
        );
        return {
            data: rows,
            pagination: {
                page: filter.page,
                limit: filter.limit,
                total,
                totalPages: Math.ceil(total / filter.limit),
            },
        };
    }

    async getSubmissionStats(
        organizationId: string,
        contestId: string
    ): Promise<SubmissionStatusCounts> {
        return this.submissionRepo.countByStatus(organizationId, contestId);
    }

    async invalidateSubmission(
        organizationId: string,
        submissionId: string,
        reason: string
    ): Promise<void> {
        const submission = await this.submissionRepo.findById(organizationId, submissionId);
        if (!submission) throw new NotFoundError("Submission not found");

        if (submission.status === "PENDING") {
            throw new BadRequestError(
                "Cannot invalidate a submission that has not been persisted yet"
            );
        }
        if (submission.status === "INVALIDATED") {
            throw new ConflictError("Submission is already invalidated");
        }

        await this.submissionRepo.markInvalidated(organizationId, submissionId);

        logger.info(
            `[SubmissionService.invalidateSubmission] ${submissionId} invalidated. Reason: ${reason}`
        );
    }

    /**
    /**
     * Helper to generate a single absent submission.
     */
    async generateSingleAbsentSubmission(
        organizationId: string,
        contestId: string,
        participantId: string
    ): Promise<void> {
        const participant = await prisma.participant.findUnique({
            where: { id: participantId },
            include: {
                contest: {
                    include: {
                        questions: true
                    }
                }
            }
        }) as any;

        if (!participant || participant.status === ParticipantStatus.DISQUALIFIED || participant.status === ParticipantStatus.ABSENT) {
            return;
        }

        const totalQuestions = participant.contest.questions.length;
        const totalMarks = participant.contest.questions.reduce((sum: number, q: any) => sum + q.marks, 0);

        await prisma.$transaction(async (tx) => {
            // Check if submission already exists
            const existing = await tx.submission.findFirst({
                where: { participantId, organizationId }
            });
            if (existing) return;

            const submission = await tx.submission.create({
                data: {
                    organizationId,
                    contestId,
                    participantId,
                    status: "EVALUATED",
                    score: 0.00,
                    percentage: 0.00,
                    timeTakenSecs: 0,
                    correct: 0,
                    wrong: 0,
                    skipped: totalQuestions,
                    attempted: 0,
                    totalQuestions,
                    source: "MANUAL",
                    submittedAt: new Date(),
                    evaluatedAt: new Date(),
                }
            });

            await tx.participant.update({
                where: { id: participantId },
                data: { status: ParticipantStatus.ABSENT }
            });

            if (totalQuestions > 0) {
                await tx.answer.createMany({
                    data: participant.contest.questions.map((cq: any) => ({
                        organizationId,
                        submissionId: submission.id,
                        questionId: cq.questionId,
                        selectedOptionId: null,
                        isCorrect: false,
                        marksAwarded: 0.00,
                    }))
                });
            }
        });
    }

    /**
     * Generate bulk absent submissions for all non-participants of a contest.
     */
    async generateAbsentSubmissions(organizationId: string, contestId: string): Promise<number> {
        const participantsWithoutSubmission = await prisma.participant.findMany({
            where: {
                organizationId,
                contestId,
                submission: { is: null },
                status: { notIn: [ParticipantStatus.DISQUALIFIED, ParticipantStatus.ABSENT] }
            },
            include: {
                contest: {
                    include: {
                        questions: true
                    }
                }
            }
        }) as any[];

        let generatedCount = 0;
        for (const p of participantsWithoutSubmission) {
            try {
                await this.generateSingleAbsentSubmission(organizationId, contestId, p.id);
                generatedCount++;
            } catch (err) {
                logger.error(`[SubmissionService.generateAbsentSubmissions] Failed to generate absent submission for participant ${p.id}: ${(err as Error).message}`);
            }
        }

        return generatedCount;
    }

    /**
     * Admin triggers bulk evaluation for a whole contest.
     * Fetches all SUBMITTED submissions and enqueues one evaluation job each.
     * addBulk = single Redis pipeline — not N separate round trips.
     * Idempotent: BullMQ silently ignores duplicate jobIds.
     */
    async triggerContestEvaluation(
        organizationId: string,
        contestId: string
    ): Promise<{ queued: number }> {
        // First, generate absent submissions for non-participants
        const absentCount = await this.generateAbsentSubmissions(organizationId, contestId);
        logger.info(`[SubmissionService.triggerContestEvaluation] Generated ${absentCount} absent submissions for contest ${contestId}`);

        const pending = await this.submissionRepo.findPendingEvaluation(
            organizationId,
            contestId
        );

        if (pending.length === 0) {
            logger.info(
                `[SubmissionService.triggerContestEvaluation] No pending submissions for contest ${contestId}`
            );
            return { queued: 0 };
        }

        await evaluationQueue.addBulk(
            pending.map((s) => ({
                name: "evaluate-submission",
                data: {
                    organizationId,
                    submissionId: s.id,
                    participantId: s.participantId,
                    contestId,
                } satisfies EvaluationJobPayload,
                opts: { jobId: s.id },
            }))
        );

        logger.info(
            `[SubmissionService.triggerContestEvaluation] Queued ${pending.length} evaluation jobs for contest ${contestId}`
        );

        return { queued: pending.length };
    }

    // ── Participant-facing ────────────────────────────────────────────────────

    /**
     * Returns a participant's own submission result.
     * Auth via contactToken at the route level or identifier lookup.
     * We support exact match by participantId, registrationRef, email, or phone.
     */
    async getMySubmission(
        identifier: string,
        options?: { contestId?: string | undefined; contestSlug?: string | undefined }
    ): Promise<any> {
        let contestId = options?.contestId;
        if (!contestId && options?.contestSlug) {
            const contest = await prisma.contest.findFirst({
                where: { slug: options.contestSlug },
            });
            if (contest) {
                contestId = contest.id;
            }
        }

        // Try exact match by participantId (UUID/ULID), registrationRef, email, or phone
        let participant = await prisma.participant.findFirst({
            where: {
                id: identifier,
                ...(contestId ? { contestId } : {}),
            },
            include: {
                contact: true,
                contest: true,
            },
        }) as any;

        if (!participant) {
            // Find by registrationRef, email, or phone
            participant = await prisma.participant.findFirst({
                where: {
                    ...(contestId ? { contestId } : {}),
                    OR: [
                        { registrationRef: { equals: identifier, mode: "insensitive" } },
                        { contact: { email: { equals: identifier, mode: "insensitive" } } },
                        { contact: { phone: { equals: identifier, mode: "insensitive" } } },
                    ],
                },
                include: {
                    contact: true,
                    contest: true,
                },
            }) as any;
        }

        if (!participant) {
            throw new NotFoundError("Participant not found");
        }

        const organizationId = participant.organizationId;
        const participantId = participant.id;

        // Fetch submission for this participant
        let submission = await this.submissionRepo.findByParticipantId(
            organizationId,
            participantId
        ) as any;

        // If no submission is found, and the contest is in EVALUATION, RESULTS_OUT, or COMPLETED state,
        // we can dynamically generate an ABSENT submission.
        const activeStates: ContestStatus[] = [ContestStatus.EVALUATION, ContestStatus.RESULTS_OUT, ContestStatus.COMPLETED];
        if (!submission && activeStates.includes(participant.contest.status)) {
            // Check if participant is already marked disqualified
            if (participant.status !== ParticipantStatus.DISQUALIFIED) {
                logger.info(`[SubmissionService.getMySubmission] Dynamically generating absent submission for participant ${participantId}`);
                await this.generateSingleAbsentSubmission(organizationId, participant.contestId, participantId);
                
                submission = await this.submissionRepo.findByParticipantId(
                    organizationId,
                    participantId
                ) as any;
            }
        }

        if (!submission) {
            throw new NotFoundError("Submission not found");
        }

        // Fetch leaderboard info if available
        const leaderboardEntry = await prisma.leaderboardEntry.findFirst({
            where: { participantId, contestId: submission.contestId, isPublished: true },
        });

        let rank: number | undefined;
        let percentile: number | undefined;
        let totalParticipants: number | undefined;

        if (leaderboardEntry) {
            const r = leaderboardEntry.rank;
            const total = await prisma.leaderboardEntry.count({
                where: { contestId: submission.contestId, isPublished: true },
            });
            rank = r;
            totalParticipants = total;
            percentile = total > 0 ? Number((100 - (r / total) * 100).toFixed(2)) : 100;
        }

        return {
            ...submission,
            rank,
            percentile,
            totalParticipants,
        };
    }

    /**
     * Manual REST-based submission.
     * Checks if a submission already exists, persists the new one, and
     * enqueues it for background evaluation.
     */
    async submit(contestId: string, input: SubmitSubmissionInput): Promise<{ submissionId: string }> {
        // 1. Resolve participant to get organizationId and validate contest
        const participant = await this.participantRepo.findById(contestId, input.participantId);
        if (!participant) {
            throw new NotFoundError("Participant not found for this contest");
        }

        const organizationId = participant.organizationId;

        // 2. Check for existing submission (idempotency safety)
        const alreadyExists = await this.submissionRepo.existsForParticipant(
            organizationId,
            input.participantId
        );

        if (alreadyExists) {
            throw new ConflictError("You have already submitted for this contest");
        }

        // 3. Reconstruct a complete answer record by matching against all contest questions
        const contestQuestions = await prisma.contestQuestion.findMany({
            where: { contestId },
            select: { questionId: true },
        });

        const totalQuestions = contestQuestions.length;

        const answerMap = new Map<string, string | null>();
        for (const ans of input.answers) {
            const normalizedOptionId = (ans.selectedOptionId === "" || ans.selectedOptionId === undefined || ans.selectedOptionId === null)
                ? null
                : ans.selectedOptionId;
            answerMap.set(ans.questionId, normalizedOptionId);
        }

        const completeAnswers = contestQuestions.map(cq => {
            const selectedOptionId = answerMap.get(cq.questionId) ?? null;
            return {
                questionId: cq.questionId,
                selectedOptionId,
            };
        });

        const attempted = completeAnswers.filter(a => a.selectedOptionId !== null).length;

        // 4. Persist the submission and answers
        const submission = await this.submissionRepo.createWithAnswers({
            organizationId,
            contestId,
            participantId: input.participantId,
            answers: completeAnswers,
            timeTakenSecs: input.timeTakenSecs,
            submittedAt: new Date(),
            source: "MANUAL",
            totalQuestions,
            attempted,
        });

        // 5. Enqueue evaluation job
        await evaluationQueue.add("evaluate-submission", {
            organizationId,
            contestId,
            participantId: input.participantId,
            submissionId: submission.id,
        } satisfies EvaluationJobPayload, {
            jobId: submission.id, // Idempotency
        });

        return { submissionId: submission.id };
    }
}
