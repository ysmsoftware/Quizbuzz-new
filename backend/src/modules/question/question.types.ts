import { QuestionDifficulty, ContestStatus } from "@prisma/client";

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export interface CreateQuestionDto {
    questionText: string;
    difficulty: QuestionDifficulty;
    hint?: string;
    explanation?: string;
    tags?: string[];
    options: CreateOptionDto[];
}

export interface CreateOptionDto {
    text: string;
    isCorrect: boolean;
    position: number; // 0-based display order
}

export interface UpdateQuestionDto {
    questionText?: string;
    difficulty?: QuestionDifficulty;
    hint?: string;
    explanation?: string;
    tags?: string[];
    options?: UpdateOptionDto[];
}

export interface UpdateOptionDto {
    id?: string;       // present = update existing; absent = create new
    text: string;
    isCorrect: boolean;
    position: number;
}

export interface BulkCreateQuestionsDto {
    questions: CreateQuestionDto[];
}

export interface BulkImportResult {
    created: number;
    failed: number;
    errors: Array<{ index: number; reason: string }>;
}

// ─── Contest-Question Assignment DTOs ────────────────────────────────────────

export interface AssignQuestionsDto {
    questions: AssignQuestionItem[];
}

export interface AssignQuestionItem {
    questionId: string;
    position: number;
    marks: number;
    negativeMark: number;
}

export interface ReorderQuestionsDto {
    order: string[]; // ordered array of questionIds — position derived from index
}

export interface UpdateContestQuestionDto {
    marks?: number;
    negativeMark?: number;
}

// ─── Query DTOs ───────────────────────────────────────────────────────────────

export interface ListQuestionsQueryDto {
    difficulty?: QuestionDifficulty;
    tags?: string;       // comma-separated
    search?: string;
    contestId?: string;  // filter to questions assigned to a specific contest
    unassignedFor?: string; // questionId NOT already in this contestId
    page: number;
    limit: number;
}

export interface ContestQuestionsQueryDto {
    includeCorrectAnswers?: boolean; // admin use — never send true to quiz participants
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface QuestionSummary {
    id: string;
    questionText: string;
    difficulty: QuestionDifficulty;
    tags: string[];
    optionCount: number;
    usedInContests: number; // how many contests use this question
    createdAt: Date;
}

export interface QuestionDetail {
    id: string;
    questionText: string;
    difficulty: QuestionDifficulty;
    hint: string | null;
    explanation: string | null;
    tags: string[];
    options: OptionDetail[];
    contestAssignments: ContestAssignmentInfo[];
    createdAt: Date;
    updatedAt: Date;
}

export interface OptionDetail {
    id: string;
    text: string;
    position: number;
    isCorrect: boolean;
}

export interface ContestAssignmentInfo {
    contestId: string;
    contestTitle: string;
    contestStatus: ContestStatus;
    position: number;
    marks: number;
    negativeMark: number;
}

export interface ContestQuestionView {
    id: string; // ContestQuestion join row id
    position: number;
    marks: number;
    negativeMark: number;
    question: {
        id: string;
        questionText: string;
        difficulty: QuestionDifficulty;
        hint: string | null;
        tags: string[];
        options: OptionDetail[];
    };
}

/**
 * The shape sent to participants during a live quiz — NO correct answer data.
 * Correct answers are deliberately excluded here and stripped by the service.
 */
export interface ParticipantQuestionView {
    id: string;
    questionText: string;
    hint: string | null;
    options: ParticipantOptionView[];
    marks: number;
    negativeMark: number;
}

export interface ParticipantOptionView {
    id: string;
    text: string;
    position: number;
    // isCorrect intentionally omitted
}

export interface ShuffledQuestionSet {
    questions: ParticipantQuestionView[];
    sessionSeed: string; // stored in Redis so same shuffle is served on reconnect
}

export interface AssignQuestionsResult {
    assigned: number;
    skipped: number; // already assigned
    positions: Array<{ questionId: string; position: number }>;
}