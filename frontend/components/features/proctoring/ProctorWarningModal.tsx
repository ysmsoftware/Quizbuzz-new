'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Users, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProctoringStore } from '@/lib/stores/proctoring-store';

// ═══════════════════════════════════════════════════════
// ProctorWarningModal — High-stakes violation modal
// ═══════════════════════════════════════════════════════

export type WarningType = 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'MULTIPLE_FACES' | 'NO_FACE';

interface ProctorWarningModalProps {
  open: boolean;
  type: WarningType;
  warningCount?: number;
  maxWarnings?: number;
  onDismiss: () => void;
  onReturnFullscreen?: () => void;
}

export function ProctorWarningModal({
  open,
  type,
  warningCount = 1,
  maxWarnings = 3,
  onDismiss,
  onReturnFullscreen,
}: ProctorWarningModalProps) {
  
  const isFlagged = (warningCount || 0) >= maxWarnings;

  if (type === 'NO_FACE') {
    return <NoFaceBanner onDismiss={onDismiss} />;
  }

  // Variants by type
  const getContent = () => {
    switch (type) {
      case 'TAB_SWITCH':
        return {
          icon: AlertTriangle,
          title: 'You Left the Quiz Window',
          body: 'Navigating away from the quiz is not allowed.',
          color: 'amber',
        };
      case 'MULTIPLE_FACES':
        return {
          icon: Users,
          title: 'Multiple Faces Detected',
          body: 'Only you should be visible during the quiz. This incident has been recorded.',
          color: 'red',
        };
      default:
        return {
          icon: AlertCircle,
          title: 'Proctoring Violation',
          body: 'An unusual activity was detected and recorded.',
          color: 'amber',
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <DialogOverlay open={open}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`
          bg-slate-900 border-2 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl
          ${content.color === 'amber' ? 'border-amber-500/30 shadow-amber-500/10' : 'border-red-500/30 shadow-red-500/10'}
        `}
      >
        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6
          ${content.color === 'amber' ? 'bg-amber-500/10' : 'bg-red-500/10'}
        `}>
          <Icon className={`w-8 h-8 ${content.color === 'amber' ? 'text-amber-500' : 'text-red-500'} ${type === 'TAB_SWITCH' ? 'animate-pulse' : ''}`} />
        </div>

        <h3 className="text-xl font-bold text-white mb-2">{content.title}</h3>
        <p className="text-sm text-white/60 mb-6 leading-relaxed">{content.body}</p>

        <div className="mb-8">
          <p className={`text-xs font-bold uppercase tracking-widest ${isFlagged ? 'text-red-500' : 'text-white/40'}`}>
            Warning {warningCount} of {maxWarnings}
          </p>
          {isFlagged && (
            <p className="text-xs text-red-500 mt-1 font-medium">
              Your session has been flagged for review.
            </p>
          )}
        </div>

        <Button
          onClick={onDismiss}
          className={`
            w-full py-6 font-semibold rounded-xl
            ${content.color === 'amber' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-500 hover:bg-red-600'}
          `}
        >
          I understand, return to quiz
        </Button>
      </motion.div>
    </DialogOverlay>
  );
}

// ═══════════════════════════════════════════════════════
// NoFaceBanner — Non-blocking bottom banner
// ═══════════════════════════════════════════════════════

function NoFaceBanner({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[45] w-full max-w-lg px-4"
    >
      <div className="bg-amber-500 text-slate-950 p-4 rounded-xl shadow-2xl flex items-center gap-4">
        <AlertCircle className="w-6 h-6 shrink-0" />
        <p className="text-sm font-semibold flex-1">
          No face detected — please ensure your face is visible to the camera
        </p>
        <button 
          onClick={() => { setVisible(false); onDismiss(); }}
          className="p-1 hover:bg-black/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// Shared Helper Components
// ═══════════════════════════════════════════════════════

function DialogOverlay({ children, open }: { children: React.ReactNode; open: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      {children}
    </div>
  );
}

export function FlaggedBanner() {
  const isFlagged = useProctoringStore((s) => s.isFlagged);
  if (!isFlagged) return null;

  return (
    <div className="bg-red-500 text-white py-2 px-4 text-center text-xs font-bold uppercase tracking-wider sticky top-0 z-50">
      ⚠ Your session has been flagged for review. An administrator will review your quiz session after submission.
    </div>
  );
}
