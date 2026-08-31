'use client';

import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS, type StepKey } from './wizard-types';

interface PhaseDef {
  title: string;
  keys: StepKey[];
}

const PHASES: PhaseDef[] = [
  {
    title: 'Setup',
    keys: ['basics', 'promotion', 'structure'],
  },
  {
    title: 'Rewards & Growth',
    keys: ['rewards', 'leaderboards'],
  },
  {
    title: 'Launch',
    keys: ['timeline', 'kit', 'review'],
  },
];

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
    <nav className="relative flex flex-col gap-6 pl-1.5">
      {/* Vertical Rail Line — centered under the step dots: nav's pl-1.5 (6px) + button's
          px-3 (12px) + half of the dot's h-6/w-6 (12px) = 30px from the nav's left edge. */}
      <div className="absolute left-[30px] top-4 bottom-4 w-[2px] bg-border/40 z-0" />

      {PHASES.map((phase) => (
        <div key={phase.title} className="relative z-10 space-y-2">
          {/* Phase Header */}
          <span className="block text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase px-3">
            {phase.title}
          </span>

          {/* Steps */}
          <div className="space-y-1">
            {phase.keys.map((key) => {
              const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === key);
              const step = WIZARD_STEPS[stepIndex]!;
              const isCurrent = step.key === current;
              const isDone = stepIndex < WIZARD_STEPS.findIndex((s) => s.key === current);
              const isReachable = stepIndex <= furthestIndex;

              return (
                <button
                  key={step.key}
                  type="button"
                  disabled={!isReachable}
                  onClick={() => onSelect(step.key)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all duration-200 group relative',
                    isCurrent && 'bg-primary/10 text-primary font-semibold',
                    !isCurrent && isReachable && 'hover:bg-muted/80 text-foreground',
                    !isReachable && 'text-muted-foreground/60 cursor-not-allowed opacity-50',
                  )}
                >
                  {/* Step Dot/Number */}
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-all duration-200 z-10',
                      isDone && 'bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20',
                      isCurrent && !isDone && 'border-primary bg-background text-primary shadow-sm shadow-primary/10 scale-105 ring-4 ring-primary/10',
                      !isCurrent && !isDone && isReachable && 'border-border bg-background text-muted-foreground group-hover:border-muted-foreground/40',
                      !isReachable && 'border-border bg-background text-muted-foreground/40',
                    )}
                  >
                    {isDone ? (
                      <Check className="h-3 w-3 stroke-[3]" />
                    ) : (
                      stepIndex + 1
                    )}
                  </span>

                  {/* Step Label */}
                  <span className={cn(
                    'flex-1 truncate transition-colors duration-200',
                    isCurrent ? 'text-primary' : 'text-foreground/80 group-hover:text-foreground'
                  )}>
                    {step.label}
                  </span>

                  {/* Optional Badge */}
                  {!step.required && (
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'text-[9px] font-medium leading-none py-0.5 px-1.5 border-border/60 text-muted-foreground',
                        isCurrent && 'border-primary/30 text-primary/80 bg-primary/5'
                      )}
                    >
                      Optional
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
