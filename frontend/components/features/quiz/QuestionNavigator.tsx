'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuizStore } from '@/lib/stores/quiz-store';

// ═══════════════════════════════════════════════════════
// QuestionNavigator — Dot grid with answer confirm flash
// ═══════════════════════════════════════════════════════

interface QuestionNavigatorProps {
  onNavigate?: (index: number) => void;
  columns?: number; // default 10 desktop, 6 mobile
}

export function QuestionNavigator({ onNavigate, columns }: QuestionNavigatorProps) {
  const questions = useQuizStore((s) => s.questions);
  const answers = useQuizStore((s) => s.answers);
  const flagged = useQuizStore((s) => s.flagged);
  const visitedQuestions = useQuizStore((s) => s.visitedQuestions);
  const currentIndex = useQuizStore((s) => s.currentQuestionIndex);
  const setCurrentQuestion = useQuizStore((s) => s.setCurrentQuestion);
  const visitQuestion = useQuizStore((s) => s.visitQuestion);

  // Answer confirm flash set
  const [confirming, setConfirming] = useState<Set<number>>(new Set());
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Listen for answer-confirmed custom events
  useEffect(() => {
    const handler = (e: Event) => {
      const qi = (e as CustomEvent<number>).detail;
      setConfirming((prev) => new Set(prev).add(qi));

      // Clear existing timeout for this index
      const existing = timeoutsRef.current.get(qi);
      if (existing) clearTimeout(existing);

      const timeout = setTimeout(() => {
        setConfirming((prev) => {
          const next = new Set(prev);
          next.delete(qi);
          return next;
        });
        timeoutsRef.current.delete(qi);
      }, 200);

      timeoutsRef.current.set(qi, timeout);
    };

    window.addEventListener('answer-confirmed', handler);
    return () => {
      window.removeEventListener('answer-confirmed', handler);
      timeoutsRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const handleClick = useCallback(
    (index: number) => {
      setCurrentQuestion(index);
      visitQuestion(index);
      onNavigate?.(index);
    },
    [setCurrentQuestion, visitQuestion, onNavigate]
  );

  const getStatus = (index: number) => {
    if (flagged.includes(index)) return 'flagged';
    if (answers[index] !== undefined) return 'answered';
    if (visitedQuestions.includes(index)) return 'visited';
    return 'unanswered';
  };

  const gridCols = columns || 10;

  return (
    <div
      className="overflow-y-auto"
      style={{ maxHeight: 'calc(100vh - 320px)' }}
    >
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
      >
        {questions.map((_, i) => {
          const status = getStatus(i);
          const isCurrent = i === currentIndex;
          const isConfirming = confirming.has(i);
          const label = i + 1;
          const isLargeNumber = label >= 10;

          // Base styles by status
          let bg: string;
          let border: string;
          let textColor: string;

          if (isConfirming) {
            bg = 'rgba(34,197,94,0.6)';
            border = 'none';
            textColor = 'text-white';
          } else {
            switch (status) {
              case 'answered':
                bg = '#1E3A5F';
                border = 'none';
                textColor = 'text-white font-medium';
                break;
              case 'flagged':
                bg = 'rgba(245,158,11,0.25)';
                border = '1.5px solid #F59E0B';
                textColor = 'text-amber-300';
                break;
              case 'visited':
                bg = 'rgba(255,255,255,0.05)';
                border = '1.5px solid rgba(255,255,255,0.40)';
                textColor = 'text-white/60';
                break;
              default: // unanswered
                bg = 'rgba(255,255,255,0.08)';
                border = '1px solid rgba(255,255,255,0.15)';
                textColor = 'text-white/40';
                break;
            }
          }

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleClick(i)}
              className={`
                w-7 h-7 rounded-full flex items-center justify-center
                cursor-pointer transition-all duration-150
                hover:brightness-[1.3]
                ${textColor}
                ${isCurrent ? 'ring-2 ring-orange-500 scale-[1.15]' : ''}
              `}
              style={{
                background: bg,
                border: border,
                fontSize: isLargeNumber ? '7px' : '8px',
              }}
              aria-label={`Question ${label}${status !== 'unanswered' ? ` (${status})` : ''}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
