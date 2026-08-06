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
            text-muted-foreground hover:text-warning hover:bg-muted/50
            transition-colors duration-150
          "
          title="Using a hint is recorded"
        >
          <Lightbulb className="w-4 h-4" />
          Show Hint
        </button>
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-warning/70 px-3 py-1.5 cursor-default">
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
            <div className="rounded-xl p-4 border bg-warning/10 border-warning/30">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs font-semibold text-warning">Hint</span>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{question.hint}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
