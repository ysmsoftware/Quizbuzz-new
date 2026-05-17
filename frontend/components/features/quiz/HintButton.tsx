'use client';

import { Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuizStore, type QuizQuestion } from '@/lib/stores/quiz-store';

// ═══════════════════════════════════════════════════════
// HintButton — Reveals hint inline below options
// ═══════════════════════════════════════════════════════

interface HintButtonProps {
  question: QuizQuestion;
  questionIndex: number;
}

export function HintButton({ question, questionIndex }: HintButtonProps) {
  const hintRevealed = useQuizStore((s) => s.hints.includes(questionIndex));
  const revealHint = useQuizStore((s) => s.revealHint);

  // Don't render if no hint available
  if (!question.hint) return null;

  return (
    <div>
      {/* Toggle button */}
      {!hintRevealed ? (
        <button
          type="button"
          onClick={() => revealHint(questionIndex)}
          className="
            flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg
            text-white/50 hover:text-amber-400 hover:bg-white/5
            transition-colors duration-150
          "
          title="Using a hint is recorded"
        >
          <Lightbulb className="w-4 h-4" />
          Show Hint
        </button>
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-amber-400/60 px-3 py-1.5 cursor-default">
          <Lightbulb className="w-3.5 h-3.5" />
          Hint used
        </span>
      )}

      {/* Hint content */}
      <AnimatePresence>
        {hintRevealed && question.hint && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-3"
          >
            <div
              className="rounded-xl p-4 border"
              style={{
                background: 'rgba(234,179,8,0.1)',
                borderColor: 'rgba(234,179,8,0.3)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">Hint</span>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{question.hint}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
