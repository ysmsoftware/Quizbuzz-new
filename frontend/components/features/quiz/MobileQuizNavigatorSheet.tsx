'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { LayoutGrid, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuizStore } from '@/lib/stores/quiz-store';
import { QuestionNavigator } from './QuestionNavigator';
import { QuizProgressStats } from './QuizProgressStats';

// ═══════════════════════════════════════════════════════
// MobileQuizNavigatorSheet — FAB + drag-to-close sheet
// ═══════════════════════════════════════════════════════

interface MobileQuizNavigatorSheetProps {
  onSubmitClick: () => void;
}

export function MobileQuizNavigatorSheet({ onSubmitClick }: MobileQuizNavigatorSheetProps) {
  const [open, setOpen] = useState(false);
  const answered = useQuizStore((s) => Object.keys(s.answers).length);
  const total = useQuizStore((s) => s.questions.length);
  const unanswered = total - answered;

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      setOpen(false);
    }
  }, []);

  return (
    <>
      {/* ─── FAB Button ───────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          sm:hidden fixed bottom-20 right-4 z-30
          w-14 h-14 rounded-full bg-orange-500 shadow-lg shadow-orange-500/25
          flex items-center justify-center
          active:scale-95 transition-transform
        "
        aria-label="Open question navigator"
      >
        <LayoutGrid className="w-5 h-5 text-white" />

        {/* Unanswered badge */}
        {unanswered > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unanswered > 99 ? '99+' : unanswered}
          </span>
        )}
      </button>

      {/* ─── Bottom Sheet ─────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="sm:hidden fixed inset-0 z-40 bg-black/60"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.1}
              onDragEnd={handleDragEnd}
              className="sm:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl overflow-hidden"
              style={{ height: '60vh', background: '#1E293B' }}
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-3">
                <h3 className="text-sm font-semibold text-white">Question Navigator</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-white/40 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stats */}
              <div className="px-4 pb-3">
                <QuizProgressStats />
              </div>

              {/* Divider */}
              <div className="h-px bg-white/10 mx-4" />

              {/* Navigator Grid — 6 cols on mobile */}
              <div className="px-4 pt-3 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(60vh - 200px)' }}>
                <QuestionNavigator
                  columns={6}
                  onNavigate={() => setOpen(false)}
                />
              </div>

              {/* Divider */}
              <div className="h-px bg-white/10 mx-4 mt-3" />

              {/* Submit Button */}
              <div className="p-4">
                <Button
                  onClick={() => {
                    setOpen(false);
                    onSubmitClick();
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 font-semibold"
                >
                  Submit All Answers
                </Button>
                {unanswered > 0 ? (
                  <p className="text-xs text-amber-400 text-center mt-1.5">
                    {unanswered} question{unanswered !== 1 ? 's' : ''} unanswered
                  </p>
                ) : (
                  <p className="text-xs text-green-400 text-center mt-1.5">
                    All answered — ready to submit!
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
