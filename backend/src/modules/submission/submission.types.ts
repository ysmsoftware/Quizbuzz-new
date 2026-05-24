import { Prisma } from "@prisma/client";
type Decimal = Prisma.Decimal;

// ─── Enums (mirror Prisma — avoids importing Prisma in every consumer) ────────

export type SubmissionStatus = "PENDING" | "SUBMITTED" | "EVALUATED" | "INVALIDATED";
export type SubmissionSource = "MANUAL" | "AUTO";

// ─── Repository input types ───────────────────────────────────────────────────

export interface CreateSubmissionInput {
    organizationId: string;
    participantId: string;
    contestId: string;
    submittedAt: Date;
    timeTakenSecs: number;
    source: SubmissionSource;
    totalQuestions: number;
    attempted: number;
    answers: Array<{
        questionId: string;
        selectedOptionId: string | null; // null = skipped
    }>;
}

export interface ApplyEvaluationInput {
    correct: number;
    wrong: number;
    skipped: number;
    attempted: number;
    score: Decimal;
    percentage: Decimal;
    isPassed: boolean;
    evaluatedAt: Date;
    scoredAnswers: Array<{
        questionId: string;
        isCorrect: boolean;
        marksAwarded: Decimal;
    }>;
}

export interface ListSubmissionsFilter {
    page: number;
    limit: number;
    status?: SubmissionStatus | undefined;
    search?: string | undefined; // matches registrationRef or contact email
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

/** Lean row — used in paginated list views */
export interface SubmissionSummary {
    id: string;
    participantId: string;
    registrationRef: string;
    contactName: string;
    contactEmail: string;
    status: SubmissionStatus;
    source: SubmissionSource;
    score: number | null;
    percentage: number | null;
    isPassed: boolean | null;
    timeTakenSecs: number | null;
    submittedAt: Date | null;
    evaluatedAt: Date | null;
}

/** Per-answer row inside SubmissionDetail */
export interface AnswerDetail {
    questionId: string;
    questionText: string;
    difficulty?: string;
    explanation?: string | null;
    selectedOptionId: string | null;
    selectedOptionText: string | null;
    correctOptionId: string;
    correctOptionText: string;
    isCorrect: boolean | null;
    marksAwarded: number | null;
}

/** Full detail — admin review or participant result page */
export interface SubmissionDetail extends SubmissionSummary {
    correct: number | null;
    wrong: number | null;
    skipped: number | null;
    attempted: number | null;
    totalQuestions: number | null;
    answers: AnswerDetail[];
}

/** Status breakdown counts for admin dashboard widget */
export interface SubmissionStatusCounts {
    pending: number;
    submitted: number;
    evaluated: number;
    invalidated: number;
    total: number;
}

/** Paginated list result */
export interface PaginatedSubmissions {
    data: SubmissionSummary[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// ─── Queue payloads (shared between quiz engine and workers) ──────────────────

/**
 * Placed on BullMQ by the quiz engine at submit time.
 * Dates are ISO strings — Date objects are not serialisable across the queue.
 */
export interface SubmissionJobPayload {
    organizationId: string;
    participantId: string;
    contestId: string;
    submittedAt: string;        // ISO string
    timeTakenSecs: number;
    source: SubmissionSource;
    totalQuestions: number;
    attempted: number;
    answers: Array<{
        questionId: string;
        selectedOptionId: string | null;
    }>;
}

/** Placed on BullMQ by the submission worker after persisting to DB */
export interface EvaluationJobPayload {
    organizationId: string;
    submissionId: string;
    participantId: string;
    contestId: string;
}
