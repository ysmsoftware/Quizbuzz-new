'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// ═══════════════════════════════════════════════════════
// AutoSubmitModal — Non-dismissible timer expiry modal
// ═══════════════════════════════════════════════════════

interface AutoSubmitModalProps {
  open: boolean;
  onAutoSubmit: () => void;
  isSubmitting?: boolean;
}

export function AutoSubmitModal({ open, onAutoSubmit, isSubmitting }: AutoSubmitModalProps) {
  // 5s per the live-room audit (issue 4b) — matches the waiting-room "get ready"
  // countdown, and is now kept in sync with the real backend deadline by the
  // caller (play/page.tsx) rather than running as a purely local timer.
  const [countdown, setCountdown] = useState(5);

  // The caller (play/page.tsx) re-renders roughly once a second while the
  // quiz timer is running, which used to hand this component a brand-new
  // `onAutoSubmit` function reference on every tick. Since that reference
  // was in this effect's dependency array, the interval below was torn
  // down and rebuilt before it ever got to fire — freezing the visible
  // countdown at "5" until something else (the backend's own auto-submit
  // event) forced the modal into its "Submitting..." state, which read as
  // the countdown being skipped entirely. Reading the callback through a
  // ref decouples "does the callback identity change" from "does the
  // interval keep running", so the countdown always plays out 5,4,3,2,1
  // regardless of how often the parent re-renders. See live-room audit,
  // issue 4b (regression).
  const onAutoSubmitRef = useRef(onAutoSubmit);
  useEffect(() => {
    onAutoSubmitRef.current = onAutoSubmit;
  });

  useEffect(() => {
    if (!open) return;

    setCountdown(5);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          onAutoSubmitRef.current();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-none bg-card shadow-2xl"
      >
        <div className="p-8 flex flex-col items-center text-center">
          <AnimatePresence mode="wait">
            {!isSubmitting ? (
              <motion.div
                key="countdown"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 12 }}
                className="flex flex-col items-center"
              >
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                  <Clock className="w-8 h-8 text-destructive" />
                </div>

                <h2 className="text-2xl font-bold text-foreground mb-2">⏰ Time is Up!</h2>
                <p className="text-muted-foreground mb-8 max-w-xs">
                  Your answers are being submitted automatically.
                </p>

                <div className="relative mb-8">
                  <span className="text-7xl font-bold text-destructive font-mono">
                    {countdown}
                  </span>
                </div>

                {/* Depleting Progress Bar */}
                <div className="w-full h-2 bg-border/40 rounded-full overflow-hidden mb-4">
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: `${(countdown / 5) * 100}%` }}
                    transition={{ duration: 1, ease: 'linear' }}
                    className="h-full bg-destructive"
                  />
                </div>

                <p className="text-xs text-muted-foreground/70 italic">
                  All your saved answers will be submitted.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="submitting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-10 flex flex-col items-center"
              >
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <h2 className="text-xl font-bold text-foreground mb-1">Submitting your answers...</h2>
                <p className="text-sm text-muted-foreground">Saving results to server</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
