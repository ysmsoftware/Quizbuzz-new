'use client';

// ═══════════════════════════════════════════════════════
// OptionButton — Premium styled list button for quiz answers
// ═══════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptionButtonProps {
  option: { index: number; text: string };
  optionLabel: string; // 'A', 'B', 'C', 'D'
  isSelected: boolean;
  isAnswered?: boolean;   // post-quiz reveal mode
  isCorrect?: boolean;
  isWrong?: boolean;
  onClick: () => void;
}

export function OptionButton({
  option,
  optionLabel,
  isSelected,
  isAnswered = false,
  isCorrect = false,
  isWrong = false,
  onClick,
}: OptionButtonProps) {
  // Determine visual state styles
  const getStyles = () => {
    if (isCorrect) {
      return {
        bg: 'bg-emerald-500/10 backdrop-blur-md',
        border: 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
        circleBg: 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white border-emerald-300/40 shadow-[0_3px_0_#065f46]',
        textClass: 'text-emerald-200',
      };
    }
    if (isWrong) {
      return {
        bg: 'bg-rose-500/10 backdrop-blur-md',
        border: 'border-rose-500/80 shadow-[0_0_20px_rgba(244,63,94,0.1)]',
        circleBg: 'bg-gradient-to-br from-rose-400 to-rose-600 text-white border-rose-300/40 shadow-[0_3px_0_#9f1239]',
        textClass: 'text-rose-200 line-through opacity-70',
      };
    }
    if (isSelected) {
      return {
        bg: 'bg-indigo-500/10 backdrop-blur-xl',
        border: 'border-indigo-500 shadow-[0_0_25px_rgba(99,102,241,0.2)]',
        circleBg: 'bg-gradient-to-b from-indigo-400 to-indigo-600 text-white border-indigo-300/40 shadow-[0_3px_0_#3730a3]',
        textClass: 'text-indigo-200 font-semibold',
      };
    }
    return {
      bg: 'bg-slate-900/40 backdrop-blur-md',
      border: 'border-slate-800/80 hover:border-slate-700/80',
      circleBg: 'bg-slate-950/80 text-slate-400 border border-slate-800 shadow-[0_3px_0_#1e293b]',
      textClass: 'text-slate-300',
    };
  };

  const styles = getStyles();
  const disabled = isAnswered && !isSelected;

  return (
    <motion.button
      type="button"
      onClick={() => !isAnswered && onClick()}
      whileHover={!isAnswered && !isSelected ? { y: -1, scale: 1.005 } : undefined}
      whileTap={!isAnswered ? { scale: 0.99 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-2xl min-h-[64px] text-left border transition-all duration-300 select-none",
        styles.bg,
        styles.border,
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer',
        !isSelected && !isCorrect && !isWrong && !isAnswered && 'hover:bg-slate-800/30'
      )}
      aria-pressed={isSelected}
      aria-label={`Option ${optionLabel}: ${option.text}`}
    >
      {/* Keyboard-styled Keycap Letter Badge */}
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-mono text-sm font-black transition-all duration-300",
          styles.circleBg
        )}
      >
        {optionLabel}
      </div>

      {/* Option Text */}
      <span className={cn("text-base flex-1 leading-snug transition-colors duration-300", styles.textClass)}>
        {option.text}
      </span>

      {/* Check/Status Indicators */}
      {isSelected && !isCorrect && !isWrong && (
        <div className="p-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex-shrink-0">
          <Check className="w-4 h-4 text-indigo-400" />
        </div>
      )}
      {isCorrect && (
        <div className="p-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex-shrink-0 animate-pulse">
          <Check className="w-4 h-4 text-emerald-400" />
        </div>
      )}
    </motion.button>
  );
}
