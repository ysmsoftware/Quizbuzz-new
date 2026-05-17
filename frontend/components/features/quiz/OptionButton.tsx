'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface OptionButtonProps {
  option: { index: number; text: string };
  optionLabel: string; // 'A', 'B', 'C', 'D'
  isSelected: boolean;
  isAnswered?: boolean;   // post-quiz reveal mode
  isCorrect?: boolean;
  isWrong?: boolean;
  onClick: () => void;
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function OptionButton({
  option,
  optionLabel,
  isSelected,
  isAnswered = false,
  isCorrect = false,
  isWrong = false,
  onClick,
}: OptionButtonProps) {
  // Determine visual state
  const getStyles = () => {
    if (isCorrect) {
      return {
        bg: 'rgba(34,197,94,0.15)',
        border: '1.5px solid #22C55E',
        circleBg: 'bg-green-500 text-white',
      };
    }
    if (isWrong) {
      return {
        bg: 'rgba(239,68,68,0.15)',
        border: '1.5px solid #EF4444',
        circleBg: 'bg-red-500 text-white',
      };
    }
    if (isSelected) {
      return {
        bg: 'rgba(249,115,22,0.15)',
        border: '1.5px solid #F97316',
        circleBg: 'bg-orange-500 text-white',
      };
    }
    return {
      bg: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.12)',
      circleBg: 'bg-white/10 text-white/70',
    };
  };

  const styles = getStyles();
  const disabled = isAnswered && !isSelected;

  return (
    <motion.button
      type="button"
      onClick={() => !isAnswered && onClick()}
      whileTap={!isAnswered ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.1 }}
      className={`
        w-full flex items-center gap-3 p-4 rounded-xl min-h-[60px] sm:min-h-[60px]
        text-left transition-all duration-150 ease-out
        ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer'}
        ${!isSelected && !isCorrect && !isWrong && !isAnswered ? 'hover:bg-white/10 hover:border-white/25' : ''}
      `}
      style={{ background: styles.bg, border: styles.border }}
      aria-pressed={isSelected}
      aria-label={`Option ${optionLabel}: ${option.text}`}
    >
      {/* Letter Circle */}
      <div
        className={`
          w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
          font-mono text-sm font-bold transition-colors
          ${styles.circleBg}
        `}
      >
        {optionLabel}
      </div>

      {/* Option Text */}
      <span
        className={`
          text-white text-base flex-1 leading-snug
          ${isWrong ? 'line-through opacity-70' : ''}
        `}
      >
        {option.text}
      </span>

      {/* Check icon when selected */}
      {isSelected && !isCorrect && !isWrong && (
        <Check className="w-[18px] h-[18px] text-orange-500 flex-shrink-0" />
      )}
      {isCorrect && (
        <Check className="w-[18px] h-[18px] text-green-500 flex-shrink-0" />
      )}
    </motion.button>
  );
}
