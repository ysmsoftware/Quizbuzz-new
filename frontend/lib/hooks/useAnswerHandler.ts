import { useCallback } from 'react';
import { useQuizStore } from '@/lib/stores/quiz-store';

/**
 * Hook for handling answer selections during the quiz.
 * Manages local store updates and socket emissions.
 * 
 * @param emitAnswer - Function to emit answer to the websocket
 */
export function useAnswerHandler(emitAnswer: (questionId: string, selectedOptionId: string | null, questionIndex: number) => void) {
    const setAnswer = useQuizStore((s) => s.setAnswer);
    const questions = useQuizStore((s) => s.questions);

    const handleAnswer = useCallback((questionIndex: number, optionIndex: number) => {
        const question = questions[questionIndex];
        if (!question) return;

        // 1. Update local store for immediate UI feedback
        setAnswer(questionIndex, optionIndex);

        // 2. Find the selected option ID from the question object
        const selectedOption = question.options.find(opt => opt.index === optionIndex);
        const selectedOptionId = selectedOption ? (selectedOption.id || String(selectedOption.index)) : null;

        // 3. Emit to server via socket
        emitAnswer(question.id, selectedOptionId, questionIndex);
    }, [questions, setAnswer, emitAnswer]);

    return {
        handleAnswer,
    };
}
