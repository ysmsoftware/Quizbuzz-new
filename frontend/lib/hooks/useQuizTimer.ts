'use client';

import { useEffect, useRef } from 'react';
import { useQuizStore } from '@/lib/stores/quiz-store';

/**
 * Hook to manage the quiz countdown timer.
 * Synchronizes with the quiz store and triggers callbacks for timeout/warnings.
 * 
 * @param onTimeout - Callback when timer reaches zero
 * @param onWarning - Callback when timer reaches warning threshold (e.g., 60s)
 */
export function useQuizTimer(onTimeout: () => void, onWarning?: () => void) {
  const timeRemaining = useQuizStore((s) => s.timeRemaining);
  const decrementTimer = useQuizStore((s) => s.decrementTimer);
  const quizState = useQuizStore((s) => s.quizState);
  
  const hasCalledTimeout = useRef(false);
  const hasCalledWarning = useRef(false);

  useEffect(() => {
    // Only run timer when quiz is actively being played
    if (quizState !== 'ACTIVE') return;

    const timer = setInterval(() => {
      decrementTimer();
    }, 1000);

    return () => clearInterval(timer);
  }, [quizState, decrementTimer]);

  // Handle side-effects of time changes
  useEffect(() => {
    // Reset refs if time is added back (e.g. sync from server)
    if (timeRemaining > 60) {
      hasCalledWarning.current = false;
      hasCalledTimeout.current = false;
    }

    // Timeout check
    if (timeRemaining <= 0 && quizState === 'ACTIVE' && !hasCalledTimeout.current) {
      hasCalledTimeout.current = true;
      onTimeout();
    }

    // Warning check (last 60 seconds)
    if (timeRemaining > 0 && timeRemaining <= 60 && !hasCalledWarning.current) {
      hasCalledWarning.current = true;
      onWarning?.();
    }
  }, [timeRemaining, quizState, onTimeout, onWarning]);

  /**
   * Format seconds into MM:SS
   */
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return { 
    timeRemaining,
    formattedTime: formatTime(timeRemaining)
  };
}
