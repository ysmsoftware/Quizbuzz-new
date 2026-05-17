import { NotFoundError, BadRequestError, ConflictError } from "../../error/http-errors";
import { SubmissionRepository } from "./submission.repository";
import { ParticipantRepository } from "../participant/participant.repository";
import { ContestRepository } from "../contest/contest.repository";
import { SubmissionStatus } from "@prisma/client";
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
    async persistSubmission(input: CreateSubmissionInput): Promise<{ submissionId: string }> {
        const alreadyExists = await this.submissionRepo.existsForParticipant(
            input.organizationId,
            input.participantId
        );

        if (alreadyExists) {
            logger.warn(
                `[SubmissionService.persistSubmission] Duplicate for participant ${input.participantId} — returning existing`
            );
            const existing = await this.submissionRepo.findByParticipantId(
                input.organizationId,
                input.participantId
            );
            return { submissionId: existing!.id };
        }

        const submission = await this.submissionRepo.createWithAnswers(input);

        logger.info(
            `[SubmissionService.persistSubmission] Persisted ${submission.id} for participant ${input.participantId}`
        );

        return { submissionId: submission.id };
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
     * Admin triggers bulk evaluation for a whole contest.
     * Fetches all SUBMITTED submissions and enqueues one evaluation job each.
     * addBulk = single Redis pipeline — not N separate round trips.
     * Idempotent: BullMQ silently ignores duplicate jobIds.
     */
    async triggerContestEvaluation(
        organizationId: string,
        contestId: string
    ): Promise<{ queued: number }> {
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
     * Auth via contactToken at the route level.
     * We resolve organizationId from the participant record since participant
     * routes don't carry an org-scoped JWT.
     */
    async getMySubmission(participantId: string): Promise<SubmissionDetail> {
        const organizationId = await this.participantRepo.findOrganizationIdByParticipantId(participantId);
        if (!organizationId) throw new NotFoundError("Participant not found");

        const submission = await this.submissionRepo.findByParticipantId(
            organizationId,
            participantId
        );
        if (!submission) throw new NotFoundError("Submission not found");
        return submission;
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

        // 3. Calculate metrics
        const totalQuestions = await this.contestRepo.countQuestions(contestId);
        const attempted = input.answers.filter(a => a.selectedOptionId !== null).length;

        // 4. Persist the submission and answers
        const submission = await this.submissionRepo.createWithAnswers({
            organizationId,
            contestId,
            participantId: input.participantId,
            answers: input.answers,
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
