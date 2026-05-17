'use client';

import { useProctoringStore } from '@/lib/stores/proctoring-store';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ═══════════════════════════════════════════════════════
// ProctoringStatusChip — Top bar monitor indicator
// ═══════════════════════════════════════════════════════

export function ProctoringStatusChip() {
  const cameraActive = useProctoringStore((s) => s.cameraStatus === 'active');
  const faceDetected = useProctoringStore((s) => s.faceDetected);
  const totalWarnings = useProctoringStore((s) => s.totalWarnings);
  const isFlagged = useProctoringStore((s) => s.isFlagged);

  const getStatus = () => {
    if (isFlagged) {
      return { 
        dot: 'bg-red-500', 
        text: 'Flagged', 
        textClass: 'text-red-400',
        badge: null 
      };
    }
    if (!cameraActive) {
      return { 
        dot: 'bg-red-500', 
        text: 'Camera Off', 
        textClass: 'text-red-400',
        badge: null 
      };
    }
    if (!faceDetected) {
      return { 
        dot: 'bg-amber-500', 
        text: 'Face not detected', 
        textClass: 'text-amber-400',
        badge: null 
      };
    }
    
    return { 
      dot: 'bg-green-500 animate-pulse', 
      text: 'Monitored', 
      textClass: 'text-white/60',
      badge: totalWarnings > 0 ? totalWarnings : null
    };
  };

  const status = getStatus();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help px-2 py-1 rounded-full hover:bg-white/5 transition-colors">
            <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            <span className={`text-[10px] font-medium uppercase tracking-wider ${status.textClass}`}>
              {status.text}
            </span>
            {status.badge !== null && (
              <span className="flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-bold px-1">
                {status.badge}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-slate-900 border-white/10 text-white text-[10px]">
          <p>Face detection active. Warnings: {totalWarnings}/3</p>
          {isFlagged && <p className="text-red-400 mt-1">Session flagged for review</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
