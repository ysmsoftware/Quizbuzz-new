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
      className="hidden sm:flex flex-col h-full w-[35%] min-w-[280px] max-w-[380px] border-l overflow-hidden"
      style={{
        background: 'rgba(15,32,64,0.6)',
        backdropFilter: 'blur(4px)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex flex-col flex-1 p-5 overflow-hidden">
        {/* Section Header */}
        <header className="mb-4">
          <h3 className="text-white/50 text-[10px] uppercase tracking-wider font-semibold mb-1">
            Questions
          </h3>
          <div className="h-px w-full bg-white/10" />
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
        <div className="h-px w-full bg-white/10 mt-4" />

        {/* Submit Button */}
        <div className="mt-4">
          <Button
            onClick={onSubmitClick}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-6 font-semibold shadow-lg shadow-orange-500/20"
          >
            Submit All Answers
          </Button>
          
          <div className="mt-2 text-center">
            {unansweredCount > 0 ? (
              <p className="text-xs text-amber-400">
                {unansweredCount} question{unansweredCount !== 1 ? 's' : ''} unanswered
              </p>
            ) : (
              <p className="text-xs text-green-400">
                All answered — ready to submit!
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
