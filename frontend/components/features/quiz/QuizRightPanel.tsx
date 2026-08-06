'use client';

import { useQuizStore } from '@/lib/stores/quiz-store';
import { QuizProgressStats } from './QuizProgressStats';
import { QuestionNavigator } from './QuestionNavigator';
import { Button } from '@/components/ui/button';

// ═══════════════════════════════════════════════════════
// QuizRightPanel — Desktop Sidebar
// ═══════════════════════════════════════════════════════

interface QuizRightPanelProps {
  onSubmitClick: () => void;
}

export function QuizRightPanel({ onSubmitClick }: QuizRightPanelProps) {
  const total = useQuizStore((s) => s.questions.length);
  const answered = useQuizStore((s) => Object.keys(s.answers).length);
  const unansweredCount = total - answered;

  return (
    <aside
      className="hidden sm:flex flex-col h-full w-[35%] min-w-[280px] max-w-[380px] border-l overflow-hidden bg-card/60 backdrop-blur-sm border-border"
    >
      <div className="flex flex-col flex-1 p-5 overflow-hidden">
        {/* Section Header */}
        <header className="mb-4">
          <h3 className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">
            Questions
          </h3>
          <div className="h-px w-full bg-border" />
        </header>

        {/* Stats */}
        <div className="mb-4">
          <QuizProgressStats />
        </div>

        {/* Question Navigator */}
        <div className="flex-1 overflow-hidden">
          <QuestionNavigator />
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-border mt-4" />

        {/* Submit Button */}
        <div className="mt-4">
          <Button
            onClick={onSubmitClick}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-6 font-semibold shadow-lg shadow-primary/20"
          >
            Submit All Answers
          </Button>

          <div className="mt-2 text-center">
            {unansweredCount > 0 ? (
              <p className="text-xs text-warning">
                {unansweredCount} question{unansweredCount !== 1 ? 's' : ''} unanswered
              </p>
            ) : (
              <p className="text-xs text-success">
                All answered — ready to submit!
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
