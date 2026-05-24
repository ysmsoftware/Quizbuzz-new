import { useCallback } from 'react';
import { useQuizStore } from '@/lib/stores/quiz-store';

/**
 * Hook for handling answer selections and confirmations during the quiz.
 *
 * Design: answer selection (option click) only updates local state for instant
 * UI feedback. The socket event is emitted when the participant explicitly
 * confirms — i.e. clicks Next or Submit — matching the intended flow:
 *
 *   select option  →  local store update (instant highlight)
 *   click Next     →  confirmAnswer(currentIndex)  →  socket emit + navigate
 *   click Submit   →  confirmAnswer(currentIndex) first, then submit
 *
 * This means:
 *   - The backend receives exactly one event per confirmed question.
 *   - Skipping a question (Next without selecting) emits selectedOptionId=null.
 *   - No answer is ever lost because of the "last question has no Next" problem:
 *     the Submit handler calls confirmAnswer before submitting.
 *
 * @param emitAnswer - Socket emit function from useQuizSocket
 */
export function useAnswerHandler(
    emitAnswer: (questionId: string, selectedOptionId: string | null, questionIndex: number) => void
) {
    const setAnswer = useQuizStore((s) => s.setAnswer);
    const questions = useQuizStore((s) => s.questions);
    const answers   = useQuizStore((s) => s.answers);

    /**
     * Called when the user clicks an option.
     * Only updates local Zustand state — no socket emit yet.
     */
    const handleAnswer = useCallback((questionIndex: number, optionIndex: number) => {
        const question = questions[questionIndex];
        if (!question) return;
        setAnswer(questionIndex, optionIndex);
    }, [questions, setAnswer]);

    /**
     * Called when the user confirms by clicking Next or Submit.
     * Emits the currently selected answer (or null for skip) to the backend.
     *
     * @param questionIndex - The index of the question being confirmed/left
     */
    const confirmAnswer = useCallback((questionIndex: number) => {
        const question = questions[questionIndex];
        if (!question) return;

        const optionIndex = answers[questionIndex];
        let selectedOptionId: string | null = null;

        if (optionIndex !== undefined) {
            const selectedOption = question.options.find(opt => opt.index === optionIndex);
            selectedOptionId = selectedOption ? (selectedOption.id || String(selectedOption.index)) : null;
        }
        // null = participant skipped this question (no option selected)
        emitAnswer(question.id, selectedOptionId, questionIndex);
    }, [questions, answers, emitAnswer]);

    return {
        handleAnswer,
        confirmAnswer,
    };
}
