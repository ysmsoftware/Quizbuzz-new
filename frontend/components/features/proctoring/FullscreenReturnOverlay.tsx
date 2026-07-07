'use client';

import { motion } from 'framer-motion';
import { Maximize2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ═══════════════════════════════════════════════════════
// FullscreenReturnOverlay — Blocks UI when not in FS
// ═══════════════════════════════════════════════════════

interface FullscreenReturnOverlayProps {
  isVisible: boolean;
  onReturn: () => void;
}

export function FullscreenReturnOverlay({ isVisible, onReturn }: FullscreenReturnOverlayProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/95 backdrop-blur-md"
    >
      <div className="max-w-md w-full text-center">
        {/* Pulsing Icon */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-8"
        >
          <Maximize2 className="w-10 h-10 text-warning" />
        </motion.div>

        <h2 className="text-2xl font-bold text-foreground mb-4">Return to Fullscreen</h2>
        
        <p className="text-muted-foreground mb-8 leading-relaxed">
          The quiz requires fullscreen mode to continue. 
          Please return to fullscreen to continue answering questions.
        </p>

        <Button
          onClick={onReturn}
          className="w-full max-w-[280px] bg-warning hover:bg-warning/90 text-warning-foreground py-6 text-lg font-semibold rounded-xl shadow-xl shadow-warning/20"
        >
          Enter Fullscreen
        </Button>

        <div className="mt-8 flex items-center justify-center gap-2 text-warning">
          <ShieldAlert className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Exiting fullscreen has been recorded
          </span>
        </div>
      </div>
    </motion.div>
  );
}
