'use client';

import { AlertTriangle, Lock } from 'lucide-react';

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export function LockedNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Shown above reward editors while a campaign is LIVE — payouts are recomputed from the current
 *  config on every read, so an edit here applies to everyone immediately, accrued amounts included. */
export function LiveEditNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
      <span>{children}</span>
    </div>
  );
}
