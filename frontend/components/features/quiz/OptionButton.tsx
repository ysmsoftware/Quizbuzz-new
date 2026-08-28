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
        bg: 'bg-success/10 backdrop-blur-md',
        border: 'border-success',
        circleBg: 'bg-gradient-to-br from-success to-success/80 text-success-foreground border-success/40 shadow-[0_3px_0_rgba(0,0,0,0.35)]',
        textClass: 'text-success',
      };
    }
    if (isWrong) {
      return {
        bg: 'bg-destructive/10 backdrop-blur-md',
        border: 'border-destructive/80',
        circleBg: 'bg-gradient-to-br from-destructive to-destructive/80 text-destructive-foreground border-destructive/40 shadow-[0_3px_0_rgba(0,0,0,0.35)]',
        textClass: 'text-destructive line-through opacity-70',
      };
    }
    if (isSelected) {
      return {
        bg: 'bg-primary/10 backdrop-blur-xl',
        border: 'border-primary',
        circleBg: 'bg-gradient-to-b from-primary to-primary/80 text-primary-foreground border-primary/40 shadow-[0_3px_0_rgba(0,0,0,0.35)]',
        textClass: 'text-primary font-semibold',
      };
    }
    return {
      bg: 'bg-card/40 backdrop-blur-md',
      border: 'border-border/80 hover:border-border',
      circleBg: 'bg-muted text-muted-foreground border border-border shadow-[0_3px_0_rgba(0,0,0,0.35)]',
      textClass: 'text-foreground/90',
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
        "w-full flex items-center gap-4 px-4 py-3 lg:p-4 rounded-2xl min-h-[56px] lg:min-h-[64px] text-left border transition-all duration-300 select-none",
        styles.bg,
        styles.border,
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer',
        !isSelected && !isCorrect && !isWrong && !isAnswered && 'hover:bg-muted/30'
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
        <div className="p-1 rounded-full bg-primary/20 border border-primary/30 flex-shrink-0">
          <Check className="w-4 h-4 text-primary" />
        </div>
      )}
      {isCorrect && (
        <div className="p-1 rounded-full bg-success/20 border border-success/30 flex-shrink-0 animate-pulse">
          <Check className="w-4 h-4 text-success" />
        </div>
      )}
    </motion.button>
  );
}
