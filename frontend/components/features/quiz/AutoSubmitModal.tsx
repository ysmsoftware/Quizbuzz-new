'use client';

import { useState, useEffect } from 'react';
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
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!open) return;

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          onAutoSubmit();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, onAutoSubmit]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md p-0 overflow-hidden border-none bg-slate-900 shadow-2xl"
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
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                  <Clock className="w-8 h-8 text-red-500" />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2">⏰ Time is Up!</h2>
                <p className="text-white/60 mb-8 max-w-xs">
                  Your answers are being submitted automatically.
                </p>

                <div className="relative mb-8">
                  <span className="text-7xl font-bold text-red-500 font-mono">
                    {countdown}
                  </span>
                </div>

                {/* Depleting Progress Bar */}
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: `${(countdown / 10) * 100}%` }}
                    transition={{ duration: 1, ease: 'linear' }}
                    className="h-full bg-red-500"
                  />
                </div>
                
                <p className="text-xs text-white/30 italic">
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
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                <h2 className="text-xl font-bold text-white mb-1">Submitting your answers...</h2>
                <p className="text-sm text-white/50">Saving results to server</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
