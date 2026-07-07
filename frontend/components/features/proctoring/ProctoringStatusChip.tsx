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
        dot: 'bg-destructive', 
        text: 'Flagged', 
        textClass: 'text-destructive',
        badge: null 
      };
    }
    if (!cameraActive) {
      return { 
        dot: 'bg-destructive', 
        text: 'Camera Off', 
        textClass: 'text-destructive',
        badge: null 
      };
    }
    if (!faceDetected) {
      return { 
        dot: 'bg-warning', 
        text: 'Face not detected', 
        textClass: 'text-warning',
        badge: null 
      };
    }
    
    return { 
      dot: 'bg-success animate-pulse', 
      text: 'Monitored', 
      textClass: 'text-muted-foreground',
      badge: totalWarnings > 0 ? totalWarnings : null
    };
  };

  const status = getStatus();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help px-2 py-1 rounded-full hover:bg-muted transition-colors">
            <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            <span className={`text-[10px] font-medium uppercase tracking-wider ${status.textClass}`}>
              {status.text}
            </span>
            {status.badge !== null && (
              <span className="flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold px-1">
                {status.badge}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-popover border border-border text-popover-foreground text-[10px]">
          <p>Face detection active. Warnings: {totalWarnings}/3</p>
          {isFlagged && <p className="text-destructive mt-1">Session flagged for review</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
