import { Queue, QueueEvents } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { SubmissionJobPayload, EvaluationJobPayload } from "../modules/submission/submission.types";
import { CertificateJobPayload, CertificateTestJobPayload } from "../modules/certificate/certificate.types";

/**
 * Shared default job options derived from config.
 * All queues use the same retry / backoff policy.
 */
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

/**
 * QueueEvents companion for certificateQueue — required by BullMQ's Job.waitUntilFinished(),
 * used only by CertificateTemplateService.testGenerate() to synchronously await a single
 * one-off test job's completion (a few seconds) instead of the frontend having to poll.
 */
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
    /**
     * Set only by an explicit, human-triggered retry (e.g. an ops admin retrying a
     * FAILED transfer from the dashboard after fixing whatever caused it). Normal
     * webhook-driven and reconciliation-driven jobs never set this — it exists to
     * bypass the "don't auto-retry a FAILED transfer in a hot loop" guard in
     * PayoutService.createRouteTransferForPayment for the one case where a human has
     * actually looked at why it failed and decided it's safe to try again.
     */
    forceRetry?: boolean;
}

/**
 * Route transfer queue.
 * Producers : PaymentService.handleWebhook (payment.captured branch)
 * Consumers : route-transfer.worker.ts
 * JobId     : `route-transfer-{paymentId}` ← dedupes concurrent webhook redeliveries
 *
 * Deliberately queued rather than fired inline from the webhook: the webhook is
 * the single source of truth for payment state and must stay fast/reliable under
 * registration-traffic bursts. Queuing gets durability (survives process restarts),
 * automatic retries via config.queue.retryAttempts/backoff, and a scheduling delay
 * (config.payout.transferDelayMs) as a safety window before funds leave the
 * primary account — all without blocking the webhook response.
 */
export const routeTransferQueue = new Queue<RouteTransferJobPayload>("route-transfer-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

// ─── Payment Cleanup ──────────────────────────────────────────────────────────

/**
 * Payment cleanup queue.
 * Producers : PaymentService.ensurePaymentCleanupRecurringJob (repeatable, no per-payment payload)
 * Consumers : payment-cleanup.worker.ts
 *
 * Periodic sweep that closes out abandoned Payment rows — still PENDING/CREATED
 * with no activity in the last config.payment.abandonedCloseAfterMs (default 24h) —
 * to FAILED, so a contest's registration list never shows an indefinitely-ambiguous
 * "pending" entry for someone who registered, abandoned checkout, and never came
 * back. Does not touch anyone actively retrying — the resume-or-fresh flow
 * (PaymentService.createOrder) already handles those via config.payment.orderReuseWindowMs.
 */
export const paymentCleanupQueue = new Queue("payment-cleanup-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});

// ─── Contest Start Reconciliation ─────────────────────────────────────────────

/**
 * Contest reconciliation queue.
 * Producers : ContestService.ensureContestStartReconciliationJob (repeatable, no per-contest payload)
 * Consumers : contest-reconciliation.worker.ts
 *
 * Periodic sweep that catches a CONTEST_START job that went missing entirely — e.g.
 * the "Two-Redis Trap" incident (job stranded in idle-mode Redis after a go-live
 * switch) — which quiz-timer.worker.ts's own staleness self-heal cannot catch, because
 * that only re-schedules a job that fires at the WRONG time, not one that never fires
 * at all. See docs/contest-start-reliability-spec.md.
 */
export const contestReconciliationQueue = new Queue("contest-reconciliation-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
});