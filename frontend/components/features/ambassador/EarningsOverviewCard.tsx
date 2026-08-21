'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Rupees } from './Rupees';
import type { DailyActivityPoint } from '@/lib/types/ambassador';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface EarningsOverviewCardProps {
  totalEarned: number;
  campaignCount: number;
  dailyRegistrations: DailyActivityPoint[];
  /** This-week-vs-last-week registration delta, as a percentage — null until 14 days of
   *  activity history exist to diff against. */
  trendPercent: number | null;
  isLoading: boolean;
}

/** Headline earnings figure plus a 7-day registration trend underneath it — replaces a
 *  single flat "Earned" stat card with something that shows momentum, not just a total. */
export function EarningsOverviewCard({ totalEarned, campaignCount, dailyRegistrations, trendPercent, isLoading }: EarningsOverviewCardProps) {
  const weekTotal = dailyRegistrations.reduce((sum, d) => sum + d.count, 0);
  const max = Math.max(1, ...dailyRegistrations.map((d) => d.count));

  return (
    <Card className="border-border/50">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total earned</p>
            <p className="text-3xl font-bold text-foreground tabular-nums">
              <Rupees amount={totalEarned} />
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Across {campaignCount} campaign{campaignCount === 1 ? '' : 's'}
              {weekTotal > 0 ? ` · ${weekTotal} registration${weekTotal === 1 ? '' : 's'} this week` : ''}
            </p>
          </div>
          {trendPercent !== null && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 shrink-0 ${
                trendPercent >= 0 ? 'text-success bg-success/10' : 'text-muted-foreground bg-secondary'
              }`}
            >
              {trendPercent >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {trendPercent >= 0 ? '+' : ''}
              {trendPercent}% vs last week
            </span>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-[52px] w-full rounded-lg" />
        ) : dailyRegistrations.length > 0 ? (
          <div>
            <div className="flex items-end gap-1.5 h-[52px]">
              {dailyRegistrations.map((d, i) => {
                const isToday = i === dailyRegistrations.length - 1;
                const heightPct = Math.max(6, Math.round((d.count / max) * 100));
                return (
                  <div key={d.date} className="flex-1 h-full flex items-end" title={`${d.count} on ${d.date}`}>
                    <div
                      className={`w-full rounded-t-[3px] rounded-b-[1px] transition-all ${isToday ? 'bg-accent' : 'bg-primary/70'}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              {dailyRegistrations.map((d) => (
                <span key={d.date} className="flex-1 text-center text-[10px] text-muted-foreground">
                  {DAY_LABELS[new Date(`${d.date}T00:00:00`).getDay()]}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
