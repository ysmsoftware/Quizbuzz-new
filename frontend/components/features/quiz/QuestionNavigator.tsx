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

          // Base styles by status — semantic theme tokens, not hardcoded hex/rgba
          let stateClass: string;

          if (isConfirming) {
            stateClass = 'bg-success/60 border border-transparent text-success-foreground';
          } else {
            switch (status) {
              case 'answered':
                stateClass = 'bg-primary/30 border border-transparent text-foreground font-medium';
                break;
              case 'flagged':
                stateClass = 'bg-warning/25 border-[1.5px] border-warning text-warning';
                break;
              case 'visited':
                stateClass = 'bg-muted/40 border-[1.5px] border-border text-muted-foreground';
                break;
              default: // unanswered
                stateClass = 'bg-muted/20 border border-border/60 text-muted-foreground/70';
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
                ${stateClass}
                ${isCurrent ? 'ring-2 ring-primary scale-[1.15]' : ''}
              `}
              style={{
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
