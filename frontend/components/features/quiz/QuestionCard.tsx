'use client';

// ═══════════════════════════════════════════════════════
// QuestionCard — Renders question header + text + media + flag
// ═══════════════════════════════════════════════════════

import type { QuizQuestion } from '@/lib/stores/quiz-store';
import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionCardProps {
  question: QuizQuestion;
  questionNumber: number;
  isFlagged?: boolean;
  onToggleFlag?: () => void;
}

export function QuestionCard({ 
  question, 
  questionNumber,
  isFlagged = false,
  onToggleFlag
}: QuestionCardProps) {
  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest font-black text-primary">
            Question {questionNumber}
          </span>
          <DifficultyBadge difficulty={question.difficulty} />
        </div>

        {/* Flag Button */}
        {onToggleFlag && (
          <button
            type="button"
            onClick={onToggleFlag}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer",
              isFlagged
                ? "bg-warning/20 border-warning/50 text-warning"
                : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-border/60"
            )}
            title={isFlagged ? "Unflag question" : "Flag question for review"}
          >
            <Flag className={cn("w-3.5 h-3.5", isFlagged ? "fill-warning text-warning" : "text-muted-foreground")} />
            <span className="hidden sm:inline">{isFlagged ? "Flagged" : "Flag"}</span>
          </button>
        )}
      </div>

      {/* Question Text */}
      <div
        className="text-foreground text-lg sm:text-xl font-medium leading-relaxed font-sans"
        dangerouslySetInnerHTML={{ __html: question.text }}
      />

      {/* Question Image if present */}
      {question.imageUrl && (
        <div className="relative mt-4 rounded-2xl overflow-hidden border border-border/80 bg-muted/40 shadow-inner group">
          <img
            src={question.imageUrl}
            alt={`Question ${questionNumber}`}
            className="w-full max-h-[320px] object-contain mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DifficultyBadge
// ═══════════════════════════════════════════════════════

function DifficultyBadge({ difficulty }: { difficulty: 'easy' | 'medium' | 'hard' }) {
  const styles = {
    easy: 'bg-success/10 text-success border-success/30',
    medium: 'bg-warning/10 text-warning border-warning/30',
    hard: 'bg-destructive/10 text-destructive border-destructive/30',
  };

  return (
    <span className={cn(
      "text-[10px] uppercase tracking-wider rounded-lg px-2 py-0.5 border font-bold capitalize",
      styles[difficulty] || styles.medium
    )}>
      {difficulty}
    </span>
  );
}
