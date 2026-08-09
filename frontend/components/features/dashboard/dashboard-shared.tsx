'use client';

import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ContestStatus } from '@/lib/api/dashboard.api';

const STATUS_CONFIG: Record<ContestStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-transparent border-border text-muted-foreground border' },
  PUBLISHED: { label: 'Registration open', className: 'bg-blue-500 text-white border-transparent' },
  REGISTRATION_CLOSED: { label: 'Registration closed', className: 'bg-amber-500 text-white border-transparent' },
  LIVE: { label: 'Live', className: 'bg-red-500 text-white border-transparent' },
  EVALUATION: { label: 'Evaluating', className: 'bg-purple-500 text-white border-transparent' },
  RESULTS_OUT: { label: 'Results out', className: 'bg-green-500 text-white border-transparent' },
  COMPLETED: { label: 'Completed', className: 'bg-slate-500 text-white border-transparent' },
  CANCELLED: { label: 'Cancelled', className: 'bg-transparent border-red-300 text-red-600 border' },
};

export function ContestStatusBadge({ status, className }: { status: ContestStatus; className?: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-secondary text-secondary-foreground' };
  return (
    <Badge variant="secondary" className={cn('shrink-0', cfg.className, className)}>
      {status === 'LIVE' && (
        <span className="flex h-1.5 w-1.5 relative mr-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
        </span>
      )}
      {cfg.label}
    </Badge>
  );
}

export const CONTEST_STATUS_ORDER: ContestStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'REGISTRATION_CLOSED',
  'LIVE',
  'EVALUATION',
  'RESULTS_OUT',
  'COMPLETED',
  'CANCELLED',
];

/**
 * Inline error state for a single widget's query — distinct from
 * WidgetErrorBoundary, which only catches render-time crashes. This covers the
 * far more common case: the fetch itself failed or timed out, and the rest of
 * the dashboard should keep working while this one card shows a retry button.
 */
export function DashboardWidgetError({
  message = "Couldn't load this data.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <AlertCircle className="h-5 w-5 text-destructive" />
      <p className="text-xs text-muted-foreground max-w-[220px]">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={onRetry}>
          <RefreshCcw className="h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  );
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`;
  }
}
