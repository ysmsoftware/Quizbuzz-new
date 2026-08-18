import { SavedAnswer } from "../quiz/quiz.types";

// ─── Repository row shape — mirrors the Prisma ParticipantProgressSnapshot model ──

export interface ProgressSnapshotRow {
    organizationId: string;
    contestId: string;
    participantId: string;
    phase: string;
    answers: Record<string, SavedAnswer>;
    questionOrder: string[] | null;
    currentQuestion: number;
    totalQuestions: number;
    violationCount: number;
    startedAt: Date | null;
    contestEndTime: Date | null;
}

// ─── rehydrateParticipant() result — enough to rebuild a submission ──────────────

export interface RehydrateResult {
    organizationId: string;
    answersArray: Array<{ questionId: string; selectedOptionId: string | null }>;
    totalQuestions: number;
    attempted: number;
    startedAt: string | null; // ISO — for timeTakenSecs calc
    /**
     * ISO — the contest's actual end time, if known. Used to anchor the
     * recovered timeTakenSecs calculation instead of "now": recovery can run
     * arbitrarily later than when the participant actually stopped
     * interacting (whenever submitQuiz() next gets called for them after
     * their session went missing), so anchoring to raw Date.now() would
     * count the entire outage/recovery-delay window as quiz-taking time.
     */
    contestEndTime: string | null;
}
