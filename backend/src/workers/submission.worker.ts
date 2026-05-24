/**
 * Submission Worker
 *
 * Responsibility: dequeue a SubmissionJobPayload, validate it, persist the
 * Submission + Answer rows to PostgreSQL, then enqueue an evaluation job.
 *
 * This file is a standalone Node process:
 *   node dist/workers/submission.worker.js
 *
 * It shares the same DI container as the API server but runs independently —
 * no Express, no HTTP, no WebSocket. Scaling is done by increasing
 * WORKER_INSTANCES in .env and spinning up more processes.
 */

import { Worker as BullMQWorker, Job, UnrecoverableError } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { submissionService } from "../container";
import { SubmissionJobPayload } from "../modules/submission/submission.types";
import { messageQueue } from "../queues";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { Worker } from "./worker.interface";

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Validates the job payload before any DB work is attempted.
 * Throws UnrecoverableError for structural problems — BullMQ will NOT retry
 * these, they move straight to the failed set for manual inspection.
 * Throws regular Error for transient issues — BullMQ WILL retry these.
 */
function validatePayload(payload: SubmissionJobPayload): void {
    if (!payload.participantId || !payload.contestId) {
        throw new UnrecoverableError(
            `[submission-worker] Invalid payload: missing required IDs. ` +
            `participantId=${payload.participantId} contestId=${payload.contestId}`
        );
    }

    if (!payload.submittedAt || isNaN(Date.parse(payload.submittedAt))) {
        throw new UnrecoverableError(
            `[submission-worker] Invalid submittedAt: "${payload.submittedAt}" for participant ${payload.participantId}`
        );
    }

    if (!Array.isArray(payload.answers)) {
        throw new UnrecoverableError(
            `[submission-worker] answers field is not an array for participant ${payload.participantId}`
        );
    }

    // A submission with zero answers is unusual but not invalid — participant
    // may have skipped everything. Allow it through; evaluation handles it.

    if (typeof payload.timeTakenSecs !== "number" || payload.timeTakenSecs < 0) {
        throw new UnrecoverableError(
            `[submission-worker] Invalid timeTakenSecs: ${payload.timeTakenSecs} for participant ${payload.participantId}`
        );
    }
}

// ─── Worker processor ─────────────────────────────────────────────────────────

async function processSubmission(job: Job<SubmissionJobPayload>): Promise<void> {
    const payload = job.data;

    logger.info(
        `[submission-worker] Job ${job.id} started — participant: ${payload.participantId} contest: ${payload.contestId} attempt: ${job.attemptsMade + 1}/${config.queue.retryAttempts}`
    );

    // ── Step 1: Validate payload ──────────────────────────────────────────────
    // UnrecoverableError → job fails permanently, no retry.
    // Any other error thrown here → BullMQ retries per config.
    validatePayload(payload);
    await job.updateProgress(10);

    // ── Step 2: Persist to DB via SubmissionService ───────────────────────────
    // Service handles idempotency: if submission already exists, it returns
    // the existing ID without a duplicate insert.
    const { submissionId, organizationId } = await submissionService.persistSubmission({
        organizationId: payload.organizationId,
        participantId:  payload.participantId,
        contestId:      payload.contestId,
        submittedAt:    new Date(payload.submittedAt),
        timeTakenSecs:  payload.timeTakenSecs,
        source:         payload.source,
        totalQuestions: payload.totalQuestions,
        attempted:      payload.attempted,
        answers:        payload.answers,
    });

    logger.info(
        `[submission-worker] Job ${job.id} — persisted submission ${submissionId}`
    );
    await job.updateProgress(50);

    // ── Step 3: Enqueue evaluation job ────────────────────────────────────────
    // jobId = submissionId → BullMQ deduplicates if evaluation was already
    // queued (e.g. admin triggered bulk evaluation first).
    await submissionService.enqueueEvaluation({
        organizationId: organizationId,
        submissionId,
        participantId:  payload.participantId,
        contestId:      payload.contestId,
    });

    logger.info(
        `[submission-worker] Job ${job.id} complete — evaluation enqueued for submission ${submissionId}`
    );
    await job.updateProgress(100);

    // ── Step 4: Enqueue submission confirmation notification ──────────────────
    // Fire-and-forget: if this fails it won't affect the submission.
    try {
        await messageQueue.add(
            "send-message",
            {
                participantId: payload.participantId,
                contestId: payload.contestId,
                organizationId: payload.organizationId,
                template: "REGISTRATION_SUCCESSFUL",
                channel: "WHATSAPP",
                params: { submissionRef: submissionId },
            },
            { jobId: `submission-confirm-${payload.participantId}` }
        );
    } catch (err) {
        logger.warn(`[submission-worker] Could not enqueue submission notification: ${err}`);
    }
}

// ─── Worker registration ──────────────────────────────────────────────────────

export class SubmissionWorker implements Worker {
    name = "submission-worker";
    private worker?: BullMQWorker<SubmissionJobPayload>;

    start() {
        this.worker = new BullMQWorker<SubmissionJobPayload>(
            "submission-queue",
            processSubmission,
            {
                connection:  redis,
                prefix:      config.queue.prefix,
                concurrency: config.queue.concurrency,
            }
        );

        // ─── Worker lifecycle events ──────────────────────────────────────────────────

        this.worker.on("completed", (job) => {
            logger.info(`[submission-worker] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            const isUnrecoverable = err instanceof UnrecoverableError;
            logger.error(
                `[submission-worker] Job ${job?.id} failed (${isUnrecoverable ? "permanent" : `attempt ${job?.attemptsMade}`}): ${err.message}`
            );
        });

        this.worker.on("error", (err) => {
            // Connection-level errors (Redis down, etc.) — worker stays alive and retries
            logger.error(`[submission-worker] Worker error: ${err.message}`);
        });

        this.worker.on("ready", () => {
            logger.info(
                `[submission-worker] Ready — concurrency: ${config.queue.concurrency} prefix: ${config.queue.prefix}`
            );
        });

        // ─── Graceful shutdown ────────────────────────────────────────────────────────
        // Drain in-flight jobs before exiting so no work is lost on SIGTERM.

        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[submission-worker] ${signal} received — draining in-flight jobs…`);
            if (this.worker) await this.worker.close();
            logger.info(`[submission-worker] Shutdown complete`);
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT",  () => shutdown("SIGINT"));
    }
}

const submissionWorkerInstance = new SubmissionWorker();
workerRegistry.register(submissionWorkerInstance);
