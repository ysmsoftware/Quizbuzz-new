import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================
// Types
// ============================================

export type QuizState = 'IDLE' | 'LOADING' | 'ACTIVE' | 'SUBMITTING' | 'SUBMITTED';
export type WsStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface QuizQuestion {
  id: string;
  index: number;
  text: string;
  imageUrl?: string;
  options: { index: number; text: string; imageUrl?: string }[];
  difficulty: 'easy' | 'medium' | 'hard';
  hint?: string;
  marks: number;
  negativeMarks: number;
  // NOTE: correctOptionIndex is NEVER stored client-side during quiz
}

export interface SessionNewPayload {
  sessionId: string;
  questions: QuizQuestion[];
  timeRemaining: number;
  totalQuestions: number;
}

export interface SessionRestoredPayload {
  sessionId: string;
  questions: QuizQuestion[];
  answers: Record<number, number>;
  flagged: number[];
  timeRemaining: number;
  resumeFromIndex: number;
  totalQuestions: number;
}

export interface QuizSubmittedPayload {
  submissionId: string;
  submittedAt: string;
  totalAnswered: number;
  totalQuestions: number;
}

// ============================================
// Store State
// ============================================

interface QuizStoreState {
  // Session identity
  contestId: string | null;
  participantId: string | null;
  sessionId: string | null;
  orgSlug: string | null;
  contestSlug: string | null;

  // Quiz content
  questions: QuizQuestion[];
  currentQuestionIndex: number;

  // Participant responses
  answers: Record<number, number>; // questionIndex → selected optionIndex
  flagged: number[];               // indices of flagged questions
  hints: number[];                 // indices where hint was revealed
  visitedQuestions: number[];      // indices visited (for navigator color)

  // Timer
  timeRemaining: number;          // seconds
  timerStartedAt: number | null;  // epoch ms when timer last synced

  // State machine
  quizState: QuizState;
  wsStatus: WsStatus;

  // Submission
  submissionId: string | null;
}

interface QuizStoreActions {
  // Session
  setContestContext(orgSlug: string, contestSlug: string, contestId: string, participantId: string): void;
  setSessionId(id: string): void;
  setQuestions(questions: QuizQuestion[]): void;
  hydrateFromSession(data: SessionRestoredPayload): void;
  resetQuiz(): void;

  // Navigation
  setCurrentQuestion(index: number): void;
  visitQuestion(index: number): void;
  nextQuestion(): void;
  previousQuestion(): void;

  // Answers
  setAnswer(questionIndex: number, optionIndex: number): void;
  clearAnswer(questionIndex: number): void;

  // Flags and hints
  toggleFlag(questionIndex: number): void;
  revealHint(questionIndex: number): void;

  // Timer
  setTimeRemaining(seconds: number): void;
  decrementTimer(): void;

  // State
  setQuizState(state: QuizState): void;
  setWsStatus(status: WsStatus): void;
  setSubmissionId(id: string): void;

  // Computed getters
  getAnsweredCount(): number;
  getUnansweredCount(): number;
  getFlaggedCount(): number;
  getQuestionStatus(index: number): 'unanswered' | 'answered' | 'flagged' | 'visited';
}

// ============================================
// Store Implementation
// ============================================

export const useQuizStore = create<QuizStoreState & QuizStoreActions>()(
  persist(
    (set, get) => ({
      // ─── Initial State ──────────────────────────
      contestId: null,
      participantId: null,
      sessionId: null,
      orgSlug: null,
      contestSlug: null,
      questions: [],
      currentQuestionIndex: 0,
      answers: {},
      flagged: [],
      hints: [],
      visitedQuestions: [],
      timeRemaining: 0,
      timerStartedAt: null,
      quizState: 'IDLE',
      wsStatus: 'disconnected',
      submissionId: null,

      // ─── Session ────────────────────────────────
      setContestContext: (orgSlug, contestSlug, contestId, participantId) =>
        set({ orgSlug, contestSlug, contestId, participantId }),

      setSessionId: (id) => set({ sessionId: id }),

      setQuestions: (questions) => set({ questions }),

      hydrateFromSession: (data) =>
        set({
          questions: data.questions,
          answers: data.answers,
          flagged: data.flagged,
          timeRemaining: data.timeRemaining,
          sessionId: data.sessionId,
          visitedQuestions: Object.keys(data.answers).map(Number),
        }),

      resetQuiz: () =>
        set({
          questions: [],
          answers: {},
          flagged: [],
          hints: [],
          visitedQuestions: [],
          currentQuestionIndex: 0,
          timeRemaining: 0,
          timerStartedAt: null,
          quizState: 'IDLE',
          submissionId: null,
          sessionId: null,
        }),

      // ─── Navigation ─────────────────────────────
      setCurrentQuestion: (index) =>
        set((state) => ({
          currentQuestionIndex: index,
          visitedQuestions: state.visitedQuestions.includes(index)
            ? state.visitedQuestions
            : [...state.visitedQuestions, index],
        })),

      visitQuestion: (index) =>
        set((state) => ({
          visitedQuestions: state.visitedQuestions.includes(index)
            ? state.visitedQuestions
            : [...state.visitedQuestions, index],
        })),

      nextQuestion: () => {
        const { currentQuestionIndex, questions } = get();
        if (currentQuestionIndex < questions.length - 1) {
          get().setCurrentQuestion(currentQuestionIndex + 1);
        }
      },

      previousQuestion: () => {
        const { currentQuestionIndex } = get();
        if (currentQuestionIndex > 0) {
          get().setCurrentQuestion(currentQuestionIndex - 1);
        }
      },

      // ─── Answers ────────────────────────────────
      setAnswer: (qi, oi) =>
        set((state) => ({
          answers: { ...state.answers, [qi]: oi },
        })),

      clearAnswer: (qi) =>
        set((state) => {
          const newAnswers = { ...state.answers };
          delete newAnswers[qi];
          return { answers: newAnswers };
        }),

      // ─── Flags & Hints ──────────────────────────
      toggleFlag: (qi) =>
        set((state) => ({
          flagged: state.flagged.includes(qi)
            ? state.flagged.filter((i) => i !== qi)
            : [...state.flagged, qi],
        })),

      revealHint: (qi) =>
        set((state) => ({
          hints: state.hints.includes(qi) ? state.hints : [...state.hints, qi],
        })),

      // ─── Timer ──────────────────────────────────
      setTimeRemaining: (seconds) =>
        set({ timeRemaining: seconds, timerStartedAt: Date.now() }),

      decrementTimer: () =>
        set((state) => ({
          timeRemaining: Math.max(0, state.timeRemaining - 1),
        })),

      // ─── State Machine ──────────────────────────
      setQuizState: (quizState) => set({ quizState }),
      setWsStatus: (wsStatus) => set({ wsStatus }),
      setSubmissionId: (id) => set({ submissionId: id }),

      // ─── Computed Getters ───────────────────────
      getAnsweredCount: () => Object.keys(get().answers).length,
      getUnansweredCount: () => get().questions.length - Object.keys(get().answers).length,
      getFlaggedCount: () => get().flagged.length,

      getQuestionStatus: (index) => {
        const { answers, flagged, visitedQuestions } = get();
        if (flagged.includes(index)) return 'flagged';
        if (answers[index] !== undefined) return 'answered';
        if (visitedQuestions.includes(index)) return 'visited';
        return 'unanswered';
      },
    }),
    {
      name: 'qc-quiz-session',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
      // Only persist response data, not UI state
      partialize: (state) => ({
        contestId: state.contestId,
        participantId: state.participantId,
        sessionId: state.sessionId,
        orgSlug: state.orgSlug,
        contestSlug: state.contestSlug,
        questions: state.questions,
        answers: state.answers,
        flagged: state.flagged,
        hints: state.hints,
        visitedQuestions: state.visitedQuestions,
        timeRemaining: state.timeRemaining,
      }),
    }
  )
);
