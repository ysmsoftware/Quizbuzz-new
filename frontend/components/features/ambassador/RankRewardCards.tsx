'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Rupees } from './Rupees';
import { leaderboardScopeKey } from '@/lib/types/ambassador';
import type { CampaignStats } from '@/lib/types/ambassador';

/** "Your rank" (one row per configured leaderboard cut this ambassador has a rank in — not
 *  just individual-ambassador, a campaign can also rank by department/group) plus "Next
 *  reward" (the rate/goodie one tier up) — both folded into ONE compact card instead of a
 *  stack of near-empty ones (each rank used to be its own full Card, mostly whitespace around
 *  a single number). Sits in the hub's sidebar column. Both derived from data GET .../stats
 *  already returns, no new API. */
export function RankRewardCards({ stats }: { stats: CampaignStats }) {
  const rankEntries = stats.leaderboardRanks.filter((r) => r.rank !== null);
  const nextTier = stats.nextTier;

  if (rankEntries.length === 0 && !nextTier) return null;

  return (
    <Card className="border-border/50 py-4 gap-0">
      {rankEntries.length > 0 && (
        <CardContent className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your rank</p>
          {rankEntries.map((rankEntry) => (
            <div key={leaderboardScopeKey(rankEntry.scope)} className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground truncate">{rankEntry.label}</span>
              <span className="text-lg font-bold text-foreground shrink-0">#{rankEntry.rank}</span>
            </div>
          ))}
        </CardContent>
      )}
      {nextTier && (
        <CardContent className={rankEntries.length > 0 ? 'pt-3 mt-3 border-t border-border/40' : undefined}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Next reward</p>
          <p className="text-xl font-bold text-foreground"><Rupees amount={nextTier.amountPerRegistration} /><span className="text-sm font-normal text-muted-foreground"> /registration</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">
            at {nextTier.label ?? 'the next tier'}{nextTier.goodie ? ` · plus ${nextTier.goodie.label}` : ''}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
