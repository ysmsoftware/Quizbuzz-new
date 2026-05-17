import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ContestPhase } from '@/lib/types';

import { cn } from '@/lib/utils';

interface ContestPhaseBadgeProps {
  phase: ContestPhase;
  className?: string;
}

export function ContestPhaseBadge({ phase, className }: ContestPhaseBadgeProps) {
  const config: Record<ContestPhase, { label: string; className: string; showDot?: boolean }> = {
    DRAFT: {
      label: 'Draft',
      className: 'bg-transparent border-slate-300 text-slate-600 border',
    },
    PUBLISHED: {
      label: 'Open for Registration',
      className: 'bg-blue-500 text-white border-transparent',
    },
    REGISTRATION_CLOSED: {
      label: 'Registration Closed',
      className: 'bg-amber-500 text-white border-transparent',
    },
    LIVE: {
      label: 'Live Now',
      className: 'bg-red-500 text-white border-transparent',
      showDot: true,
    },
    ENDED: {
      label: 'Ended',
      className: 'bg-slate-500 text-white border-transparent',
    },
    RESULTS_PUBLISHED: {
      label: 'Results Published',
      className: 'bg-green-500 text-white border-transparent',
    },
    CANCELLED: {
      label: 'Cancelled',
      className: 'bg-transparent border-red-300 text-red-600 border',
    },
  };

  const current = config[phase];

  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-2", 
        current.className, 
        className
      )}
    >
      {current.showDot && (
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
        </span>
      )}
      {current.label}
    </Badge>
  );
}
