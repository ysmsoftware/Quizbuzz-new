'use client';

import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, Wifi } from 'lucide-react';
import { WSConnectionStatus } from './WSConnectionStatus';
import { useQuizStore } from '@/lib/stores/quiz-store';

// ═══════════════════════════════════════════════════════
// QuizLoadingScreen — Full-page preparing screen
// ═══════════════════════════════════════════════════════

export function QuizLoadingScreen() {
  const wsStatus = useQuizStore((s) => s.wsStatus);
  const totalQuestions = useQuizStore((s) => s.questions.length);

  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center" style={{ background: '#0F172A' }}>
      <div className="flex flex-col items-center text-center max-w-xs">
        {/* Logo area */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-12 border border-white/10"
        >
          <ShieldCheck className="w-6 h-6 text-white/40" />
        </motion.div>

        {/* Spinner */}
        <div className="relative mb-8">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin" strokeWidth={2} />
        </div>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white text-lg font-bold mb-1"
        >
          Preparing your quiz...
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-white/40 text-sm"
        >
          {totalQuestions > 0 ? `Loading ${totalQuestions} questions` : 'Connecting to secure server...'}
        </motion.p>
      </div>

      {/* Bottom WS status */}
      <div className="absolute bottom-12 flex flex-col items-center gap-3">
        <WSConnectionStatus status={wsStatus} variant="compact" />
        <div className="flex items-center gap-2 text-[10px] text-white/20 uppercase tracking-widest font-medium">
          <Wifi className="w-3 h-3" />
          Encrypted Connection
        </div>
      </div>
    </div>
  );
}
