import { Queue, QueueEvents } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { SubmissionJobPayload, EvaluationJobPayload } from "../modules/submission/submission.types";
import { CertificateJobPayload, CertificateTestJobPayload } from "../modules/certificate/certificate.types";

/** Shared default job options for BullMQ queues (retry/backoff policy). */
const defaultJobOptions = {
    attempts: config.queue.retryAttempts,
    backoff: {
        type: config.queue.backoff.type,
        delay: config.queue.backoff.delay,
    },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 2000 },
};

/**
 * Submission queue.
 * Producers : quiz engine (QuizEngineService.submitQuiz)
 * Consumers : submission.worker.ts
 * JobId     : participantId
 */
export const submissionQueue = new Queue<SubmissionJobPayload>("submission-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

/**
 * Evaluation queue.
 * Producers : submission.worker, SubmissionService.triggerContestEvaluation
 * Consumers : evaluation.worker.ts
 * JobId     : submissionId
 */
export const evaluationQueue = new Queue<EvaluationJobPayload>("evaluation-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

/**
 * Certificate generation queue.
 * Producers : CertificateService (single issue + bulk issue),
 *             CertificateTemplateService.testGenerate (one-off admin "Test Generate PDF")
 * Consumers : certificate.worker.ts
 * JobId     : certificateId for real jobs (dedup); `test-{testId}` for test jobs
 *
 * CertificateQueueJobData is a union — the worker discriminates real vs. test jobs by
 * job name ("generate-certificate" vs "generate-certificate-test"), not by payload shape.
 */
export type CertificateQueueJobData = CertificateJobPayload | CertificateTestJobPayload;

export const certificateQueue = new Queue<CertificateQueueJobData>("certificate-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

/** QueueEvents to await certificate generation synchronously for test certificates. */
export const certificateQueueEvents = new QueueEvents("certificate-queue", {
    connection: redis,
    prefix: config.queue.prefix,
});

/**
 * Analytics snapshot queue.
 * Producers : AnalyticsService (periodic job)
 * Consumers : analytics.worker.ts
 */
export const analyticsQueue = new Queue("analytics-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

export const messageQueue = new Queue("message-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions
});

// ─── Quiz Timer Types ─────────────────────────────────────────────────────────

export interface QuizTimerJobPayload {
    contestId: string;
    organizationId: string;
    type: "CONTEST_START" | "TIME_WARNING" | "AUTO_SUBMIT" | "CAPTURE_REQUEST" | "MARK_ABSENT" | "AUTO_DECLARE_RESULTS";
    /** For TIME_WARNING: seconds remaining */
    secondsRemaining?: number;
    /** For CAPTURE_REQUEST: participant + capture type */
    participantId?: string;
    captureType?: string;
}

/**
 * Quiz timer queue.
 * Producers : QuizSchedulerService (schedules delayed jobs at contest publish)
 * Consumers : quiz-timer.worker.ts
 * JobId     : `{type}-{contestId}[-{participantId}]` for deduplication
 */
export const quizTimerQueue = new Queue<QuizTimerJobPayload>("quiz-timer-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});


export interface LeaderboardBuildPayload {
    contestId: string;
    organizationId: string;
}

export const leaderboardQueue = new Queue<LeaderboardBuildPayload>("leaderboard-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

export interface CaptureMetadataJobPayload {
    participantId: string;
    contestId: string;
    organizationId: string;
    type: string;
    storageKey?: string;
    severity?: number;
    metadata?: Record<string, any>;
    occurredAt?: string;
}

export const captureMetadataQueue = new Queue<CaptureMetadataJobPayload>("capture-metadata-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

export interface ExportJobPayload {
    exportId: string;
}

export const exportQueue = new Queue<ExportJobPayload>("export-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

// ─── Route Transfer ──────────────────────────────────────────────────────────

export interface RouteTransferJobPayload {
    paymentId: string;
    organizationId: string;
    amount: number;
    razorpayPaymentId: string;
    currency: string;
    /** Bypasses auto-retry loops on manual admin retries for failed transfers. */
    forceRetry?: boolean;
}

/** Queue for route payouts to transfer payment funds after a safety delay. */
export const routeTransferQueue = new Queue<RouteTransferJobPayload>("route-transfer-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

// ─── Payment Cleanup ──────────────────────────────────────────────────────────

/** Periodic sweep that closes out abandoned pending payment records to FAILED. */
export const paymentCleanupQueue = new Queue("payment-cleanup-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

// ─── Contest Start Reconciliation ─────────────────────────────────────────────

/** Periodic sweep that ensures missing or stranded CONTEST_START jobs are rescheduled. */
export const contestReconciliationQueue = new Queue("contest-reconciliation-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

// ─── Audit Log Retention ───────────────────────────────────────────────────────

/** Daily sweep that deletes audit log rows older than the retention threshold. */
export const auditRetentionQueue = new Queue("audit-retention-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

// ─── Progress Snapshot (Redis durability) ─────────────────────────────────────

/** Periodic sweep that backs up live-contest participant state from Redis to Postgres. */
export const progressSnapshotQueue = new Queue("progress-snapshot-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

// ─── Job Checkpoint Drain ──────────────────────────────────────────────────────

/** Queue that batches and flushes job timing data from a Redis Stream into Postgres. */
export const checkpointDrainQueue = new Queue("checkpoint-drain-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});