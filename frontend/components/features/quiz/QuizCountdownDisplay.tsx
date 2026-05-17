'use client';

import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';

// ═══════════════════════════════════════════════════════
// QuizCountdownDisplay — Multi-color timer with sync dot
// ═══════════════════════════════════════════════════════

interface QuizCountdownDisplayProps {
  timeRemaining: number;
}

export function QuizCountdownDisplay({ timeRemaining }: QuizCountdownDisplayProps) {
  const [showSync, setShowSync] = useState(false);

  // Listen for TIMER_SYNC custom event
  useEffect(() => {
    const handler = () => {
      setShowSync(true);
      const timer = setTimeout(() => setShowSync(false), 2000);
      return () => clearTimeout(timer);
    };
    window.addEventListener('timer-synced', handler);
    return () => window.removeEventListener('timer-synced', handler);
  }, []);

  const { display, colorClass, isFlash } = useMemo(() => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    let color = 'text-white';
    let flash = false;

    if (timeRemaining <= 0) {
      color = 'text-red-600';
    } else if (timeRemaining < 60) {
      color = 'text-red-400';
      flash = true;
    } else if (timeRemaining <= 300) {
      color = 'text-red-400';
    } else if (timeRemaining <= 600) {
      color = 'text-amber-400';
    }

    return { display: formatted, colorClass: color, isFlash: flash };
  }, [timeRemaining]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <motion.span
          className={`font-mono text-2xl sm:text-3xl font-bold tracking-tight transition-colors duration-500 ${colorClass} ${
            isFlash ? 'animate-pulse' : ''
          }`}
        >
          {display}
        </motion.span>

        {/* Sync Indicator */}
        <AnimatePresence>
          {showSync && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[8px] text-green-400 font-medium uppercase tracking-tighter"
            >
              <Clock className="w-2 h-2" />
              synced
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
