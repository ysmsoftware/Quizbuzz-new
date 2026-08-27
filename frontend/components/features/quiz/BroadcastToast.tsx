'use client';

import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Megaphone, Info, AlertTriangle, AlertCircle } from 'lucide-react';

// ═══════════════════════════════════════════════════════
// BroadcastToast — Admin → all-participants message.
//
// Deliberately its own component instead of reusing toast.error/warning/info:
// those are also used for every other in-quiz alert (proctoring warnings,
// connection status, submit results), so an admin broadcast looked identical
// to a routine system alert. This gives it a distinct color scheme per
// severity (matching the admin composer's own info/warning/urgent colors —
// see components/features/live-monitor/BroadcastPanel.tsx), a clear
// "Broadcast to all participants" label, and a visible 5s countdown bar
// instead of an invisible auto-dismiss timer. See live-room audit, issue 3.
// ═══════════════════════════════════════════════════════

export type BroadcastToastType = 'info' | 'warning' | 'urgent';

export interface BroadcastToastData {
  type: BroadcastToastType;
  text: string;
}

const BROADCAST_DURATION_MS = 5000;

const STYLES: Record<
  BroadcastToastType,
  { bg: string; border: string; bar: string; label: string; Icon: typeof Info }
> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    border: 'border-blue-300 dark:border-blue-800',
    bar: 'bg-blue-500',
    label: 'text-blue-700 dark:text-blue-300',
    Icon: Info,
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/60',
    border: 'border-amber-300 dark:border-amber-800',
    bar: 'bg-amber-500',
    label: 'text-amber-700 dark:text-amber-300',
    Icon: AlertTriangle,
  },
  urgent: {
    bg: 'bg-red-50 dark:bg-red-950/60',
    border: 'border-red-300 dark:border-red-800',
    bar: 'bg-red-500',
    label: 'text-red-700 dark:text-red-300',
    Icon: AlertCircle,
  },
};

function BroadcastToastContent({ text, type }: BroadcastToastData) {
  const s = STYLES[type] ?? STYLES.info;
  const { Icon } = s;

  return (
    <div
      className={`w-full max-w-sm rounded-xl border ${s.bg} ${s.border} shadow-lg overflow-hidden`}
      role="status"
    >
      <div className="flex items-start gap-2.5 p-3">
        <Megaphone className={`h-4 w-4 mt-0.5 shrink-0 ${s.label}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-black uppercase tracking-wider ${s.label}`}>
            Broadcast to all participants
          </p>
          <p className="text-sm text-foreground mt-0.5 break-words leading-snug">{text}</p>
        </div>
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${s.label}`} />
      </div>

      {/* Visible 5s countdown bar — kept in sync with the toast's own
          `duration` below so what's shown actually matches when it dismisses. */}
      <div className="h-1 w-full bg-black/10 dark:bg-white/10">
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: BROADCAST_DURATION_MS / 1000, ease: 'linear' }}
          className={`h-full ${s.bar}`}
        />
      </div>
    </div>
  );
}

export function showBroadcastToast(data: BroadcastToastData) {
  toast.custom(() => <BroadcastToastContent text={data.text} type={data.type} />, {
    position: 'top-right',
    duration: BROADCAST_DURATION_MS,
    id: `broadcast-${Date.now()}`,
  });
}
