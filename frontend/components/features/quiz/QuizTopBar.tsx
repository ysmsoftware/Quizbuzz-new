'use client';

import { CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuizStore } from '@/lib/stores/quiz-store';
import { QuizCountdownDisplay } from './QuizCountdownDisplay';
import { ProctoringStatusChip } from '@/components/features/proctoring/ProctoringStatusChip';

// ═══════════════════════════════════════════════════════
// QUIZ TOP BAR
// ═══════════════════════════════════════════════════════

interface QuizTopBarProps {
  contestTitle: string;
  onSubmitClick: () => void;
}

export function QuizTopBar({ contestTitle, onSubmitClick }: QuizTopBarProps) {
  const currentIndex = useQuizStore((s) => s.currentQuestionIndex);
  const totalQuestions = useQuizStore((s) => s.questions.length);
  const timeRemaining = useQuizStore((s) => s.timeRemaining);
  const answeredCount = Object.keys(useQuizStore((s) => s.answers)).length;
  const wsStatus = useQuizStore((s) => s.wsStatus);

  return (
    <>
      {/* ─── Desktop Top Bar ──────────────────────── */}
      <header
        className="hidden sm:flex h-[56px] items-center justify-between px-4 shrink-0 border-b z-40 bg-card/95 backdrop-blur-md border-border"
      >
        {/* Left: Title + Question badge */}
        <div className="flex items-center gap-3">
          <span className="text-foreground text-sm font-medium truncate max-w-[200px] lg:max-w-[280px]">
            {contestTitle}
          </span>
          <span className="bg-muted text-muted-foreground text-[10px] rounded-full px-2 py-0.5 font-mono">
            Q {currentIndex + 1} / {totalQuestions}
          </span>
        </div>

        {/* Center: Timer */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <QuizCountdownDisplay timeRemaining={timeRemaining} />
        </div>

        {/* Right: Status + Submit */}
        <div className="flex items-center gap-3">
          <ProctoringStatusChip />

          <Button
            onClick={onSubmitClick}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 rounded-lg px-6 font-semibold shadow-lg shadow-primary/20"
          >
            Submit Quiz
          </Button>
        </div>
      </header>

      {/* ─── Mobile Top Bar ───────────────────────── */}
      <header className="sm:hidden shrink-0 z-40 bg-card/95 backdrop-blur-md">
        <div className="h-[44px] flex items-center justify-between px-3">
          <span className="text-muted-foreground text-sm font-mono">
            Q{currentIndex + 1}/{totalQuestions}
          </span>
          <QuizCountdownDisplay timeRemaining={timeRemaining} />
          <button type="button" onClick={onSubmitClick} className="text-foreground p-1">
            <CheckSquare className="w-5 h-5" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 w-full bg-border/40">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
          />
        </div>
      </header>
    </>
  );
}
