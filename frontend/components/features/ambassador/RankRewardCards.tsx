'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Rupees } from './Rupees';
import { leaderboardScopeKey } from '@/lib/types/ambassador';
import type { CampaignStats } from '@/lib/types/ambassador';

/** "Your rank" — one mini-card per configured leaderboard cut this ambassador has a rank in
 *  (not just individual-ambassador; a campaign can also rank by department/group) — plus
 *  "Next reward" (the rate/goodie one tier up). Sits in the hub's sidebar column. Both
 *  derived from data GET .../stats already returns, no new API. */
export function RankRewardCards({ stats }: { stats: CampaignStats }) {
  const rankEntries = stats.leaderboardRanks.filter((r) => r.rank !== null);
  const nextTier = stats.nextTier;

  if (rankEntries.length === 0 && !nextTier) return null;

  return (
    <div className="grid grid-cols-1 gap-3">
      {rankEntries.map((rankEntry) => (
        <Card key={leaderboardScopeKey(rankEntry.scope)} className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Your rank</p>
            <p className="text-2xl font-bold text-foreground">#{rankEntry.rank}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{rankEntry.label}</p>
          </CardContent>
        </Card>
      ))}
      {nextTier && (
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Next reward</p>
            <p className="text-2xl font-bold text-foreground"><Rupees amount={nextTier.amountPerRegistration} /><span className="text-sm font-normal text-muted-foreground"> /registration</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">
              at {nextTier.label ?? 'the next tier'}{nextTier.goodie ? ` · plus ${nextTier.goodie.label}` : ''}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
