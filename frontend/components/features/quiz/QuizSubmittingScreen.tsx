'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════
// QuizSubmittingScreen — Transition screen for final save
// ═══════════════════════════════════════════════════════

export function QuizSubmittingScreen() {
  const steps = [
    { text: 'Saving your answers...', delay: 0 },
    { text: 'Validating submission...', delay: 1.5 },
    { text: 'Generating confirmation...', delay: 3 },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-slate-950">
      <div className="text-center">
        <Loader2 className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-8" />
        
        <h2 className="text-2xl font-bold text-white mb-6">Submitting your answers...</h2>

        <div className="space-y-4 mb-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: step.delay }}
              className="flex items-center justify-center gap-3 text-white/60 text-sm"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500/50" />
              {step.text}
            </motion.div>
          ))}
        </div>

        <p className="text-xs text-amber-500/80 font-medium">
          Please don't close this tab.
        </p>
      </div>
    </div>
  );
}
