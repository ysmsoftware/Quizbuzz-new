'use client';

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
    </Card>
  );
}
