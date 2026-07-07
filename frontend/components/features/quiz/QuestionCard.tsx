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
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest font-black text-indigo-400">
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
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            )}
            title={isFlagged ? "Unflag question" : "Flag question for review"}
          >
            <Flag className={cn("w-3.5 h-3.5", isFlagged ? "fill-amber-400 text-amber-400" : "text-slate-400")} />
            <span className="hidden sm:inline">{isFlagged ? "Flagged" : "Flag"}</span>
          </button>
        )}
      </div>

      {/* Question Text */}
      <div
        className="text-slate-100 text-lg sm:text-xl font-medium leading-relaxed font-sans"
        dangerouslySetInnerHTML={{ __html: question.text }}
      />

      {/* Question Image if present */}
      {question.imageUrl && (
        <div className="relative mt-4 rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/40 shadow-inner group">
          <img
            src={question.imageUrl}
            alt={`Question ${questionNumber}`}
            className="w-full max-h-[320px] object-contain mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 to-transparent pointer-events-none" />
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
    easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.05)]',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.05)]',
    hard: 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.05)]',
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
