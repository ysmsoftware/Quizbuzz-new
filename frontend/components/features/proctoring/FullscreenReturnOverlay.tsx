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
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ background: 'rgba(15,32,64,0.97)', backdropFilter: 'blur(12px)' }}
    >
      <div className="max-w-md w-full text-center">
        {/* Pulsing Icon */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-8"
        >
          <Maximize2 className="w-10 h-10 text-orange-500" />
        </motion.div>

        <h2 className="text-2xl font-bold text-white mb-4">Return to Fullscreen</h2>
        
        <p className="text-white/70 mb-8 leading-relaxed">
          The quiz requires fullscreen mode to continue. 
          Please return to fullscreen to continue answering questions.
        </p>

        <Button
          onClick={onReturn}
          className="w-full max-w-[280px] bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg font-semibold rounded-xl shadow-xl shadow-orange-500/20"
        >
          Enter Fullscreen
        </Button>

        <div className="mt-8 flex items-center justify-center gap-2 text-amber-400">
          <ShieldAlert className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Exiting fullscreen has been recorded
          </span>
        </div>
      </div>
    </motion.div>
  );
}
