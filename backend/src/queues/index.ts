import { Queue } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { SubmissionJobPayload, EvaluationJobPayload } from "../modules/submission/submission.types";
import { CertificateJobPayload } from "../modules/certificate/certificate.types";

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
 * Producers : CertificateService (single issue + bulk issue)
 * Consumers : certificate.worker.ts
 * JobId     : certificateId  ← deduplication; safe to call addJob twice
 */
export const certificateQueue = new Queue<CertificateJobPayload>("certificate-queue", {
    connection: redis,
    prefix: config.queue.prefix,
    defaultJobOptions,
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