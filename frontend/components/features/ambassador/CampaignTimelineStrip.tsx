'use client';

import { Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CampaignPhase } from '@/lib/types/ambassador';

/** Which phase `now` falls in, and days left until the campaign's registration window
 *  closes — both derived client-side from the phase snapshot the campaign already stores. */
export function CampaignTimelineStrip({ status, endDate, phases }: { status: string; endDate: string | null; phases: CampaignPhase[] }) {
  if (status !== 'LIVE' || phases.length === 0 || !endDate) return null;

  const now = Date.now();
  const end = new Date(endDate).getTime();
  if (now >= end) return null;

  const activeIndex = phases.findIndex((p) => now >= new Date(p.startsAt).getTime() && now < new Date(p.endsAt).getTime());
  const activePhase = activeIndex === -1 ? phases[phases.length - 1] : phases[activeIndex];
  const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

  return (
    <Card className="border-border/50 px-5 py-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
        <span className="text-sm font-bold text-foreground">{activePhase?.label}</span>
        <span className="text-xs text-muted-foreground">{daysLeft} day{daysLeft === 1 ? '' : 's'} left to register</span>
      </div>
      <div className="flex gap-1">
        {phases.map((p, i) => (
          <span
            key={p.key}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i < activeIndex ? 'bg-primary' : i === activeIndex ? 'bg-primary/50' : 'bg-muted'
            )}
          />
        ))}
      </div>
      {/* One label per segment (not just the active phase's, above) — so a passed or
          upcoming phase is still identifiable instead of reading as a blank colored bar. */}
      <div className="flex gap-1 mt-1.5">
        {phases.map((p, i) => {
          const isPast = i < activeIndex;
          const isActive = i === activeIndex;
          return (
            <div key={p.key} className="flex-1 min-w-0 flex items-center gap-1" title={p.label}>
              {isPast && <Check className="h-2.5 w-2.5 text-primary shrink-0" />}
              <span
                className={cn(
                  'text-[10px] truncate leading-tight',
                  isActive ? 'font-semibold text-foreground' : isPast ? 'text-muted-foreground' : 'text-muted-foreground/50'
                )}
              >
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
