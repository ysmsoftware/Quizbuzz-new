'use client';

import { Flag } from 'lucide-react';
import { useQuizStore } from '@/lib/stores/quiz-store';

// ═══════════════════════════════════════════════════════
// FlagButton — Toggle flag on a question
// ═══════════════════════════════════════════════════════

interface FlagButtonProps {
  questionIndex: number;
  emitFlag: (qi: number, flagged: boolean) => void;
}

export function FlagButton({ questionIndex, emitFlag }: FlagButtonProps) {
  const isFlagged = useQuizStore((s) => s.flagged.includes(questionIndex));
  const toggleFlag = useQuizStore((s) => s.toggleFlag);

  const handleClick = () => {
    toggleFlag(questionIndex);
    emitFlag(questionIndex, !isFlagged);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        flex items-center gap-1.5 text-sm p-2 rounded-lg
        transition-all duration-150
        ${isFlagged
          ? 'text-amber-400 bg-amber-500/10'
          : 'text-white/40 hover:text-amber-400 hover:bg-white/5'
        }
      `}
      title={isFlagged ? 'Remove flag' : 'Flag for review'}
      aria-pressed={isFlagged}
    >
      <Flag
        className="w-4 h-4"
        fill={isFlagged ? 'currentColor' : 'none'}
      />
      <span className="hidden sm:inline">
        {isFlagged ? 'Flagged' : 'Flag'}
      </span>
    </button>
  );
}
