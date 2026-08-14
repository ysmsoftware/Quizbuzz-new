'use client';

import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS, type StepKey } from './wizard-types';

export function StepperNav({
  current,
  furthestVisited,
  onSelect,
}: {
  current: StepKey;
  /** Steps up to and including this one are reachable — no jumping ahead of what's been saved. */
  furthestVisited: StepKey;
  onSelect: (key: StepKey) => void;
}) {
  const furthestIndex = WIZARD_STEPS.findIndex((s) => s.key === furthestVisited);

  return (
    <nav className="space-y-1">
      {WIZARD_STEPS.map((step, i) => {
        const isCurrent = step.key === current;
        const isDone = i < WIZARD_STEPS.findIndex((s) => s.key === current);
        const isReachable = i <= furthestIndex;

        return (
          <button
            key={step.key}
            type="button"
            disabled={!isReachable}
            onClick={() => onSelect(step.key)}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
              isCurrent && 'bg-primary/10 text-primary font-medium',
              !isCurrent && isReachable && 'hover:bg-muted text-foreground',
              !isReachable && 'text-muted-foreground cursor-not-allowed opacity-60',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]',
                isDone && 'bg-primary border-primary text-primary-foreground',
                isCurrent && !isDone && 'border-primary text-primary',
                !isCurrent && !isDone && 'border-muted-foreground/30 text-muted-foreground',
              )}
            >
              {isDone ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="flex-1">{step.label}</span>
            {!step.required && <Badge variant="outline" className="text-[10px] font-normal">Optional</Badge>}
          </button>
        );
      })}
    </nav>
  );
}
