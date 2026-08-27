'use client';

import { motion } from 'framer-motion';
import { Eye, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ═══════════════════════════════════════════════════════
// FocusReturnOverlay — Blocks UI when window is blurred
// ═══════════════════════════════════════════════════════

interface FocusReturnOverlayProps {
  isVisible: boolean;
}

export function FocusReturnOverlay({ isVisible }: FocusReturnOverlayProps) {
  if (!isVisible) return null;

  const handleReturnFocus = () => {
    window.focus();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/85 backdrop-blur-xl"
    >
      <div className="max-w-md w-full text-center">
        {/* Pulsing Icon */}
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-8 border border-destructive/20"
        >
          <Eye className="w-10 h-10 text-destructive" />
        </motion.div>

        <h2 className="text-2xl font-extrabold text-foreground mb-4 tracking-tight">Focus Lost</h2>
        
        <p className="text-muted-foreground mb-8 leading-relaxed text-sm">
          The quiz window has lost focus. You may have switched applications or clicked onto an overlay.
          Please click the button below or click inside this window to resume your quiz.
        </p>

        <Button
          onClick={handleReturnFocus}
          className="w-full max-w-[280px] bg-destructive hover:bg-destructive/90 text-destructive-foreground py-6 text-lg font-semibold rounded-xl shadow-xl shadow-destructive/20"
        >
          Resume Quiz
        </Button>

        <div className="mt-8 flex items-center justify-center gap-2 text-destructive">
          <ShieldAlert className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Leaving the quiz window has been recorded
          </span>
        </div>
      </div>
    </motion.div>
  );
}
