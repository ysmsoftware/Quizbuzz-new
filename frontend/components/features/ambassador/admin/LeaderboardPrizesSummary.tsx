'use client';

import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { Rupees } from '../Rupees';
import { GoodieThumb } from '../GoodieThumb';
import type { LeaderboardCut, LeaderboardRankReward } from '@/lib/types/ambassador';

function rankLabel(r: LeaderboardRankReward): string {
  if (r.rankRange) return `Rank ${r.rankRange[0]}–${r.rankRange[1]}`;
  if (r.rank) return `Rank ${r.rank}`;
  return 'Winner';
}

/** Read-only, fully detailed view of every configured leaderboard — what it ranks by and what
 *  each rank wins. Used once a campaign's rewards are locked (ENDED/ARCHIVED), where the editor
 *  is no longer shown but the org still needs to see exactly what was offered. */
export function LeaderboardPrizesSummary({
  cuts,
  ambassadorTypesAllowed,
}: {
  cuts: LeaderboardCut[];
  ambassadorTypesAllowed: string[];
}) {
  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');

  const fieldLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const t of types) {
      if (!ambassadorTypesAllowed.includes(t.key)) continue;
      for (const f of t.applicationFields) labels.set(f.key, f.label);
    }
    return labels;
  }, [types, ambassadorTypesAllowed]);

  if (cuts.length === 0) {
    return <p className="text-sm text-muted-foreground">No leaderboards were configured for this campaign.</p>;
  }

  return (
    <div className="space-y-3">
      {cuts.map((cut, i) => {
        const groupedBy = (cut.scope.groupByFieldKeys ?? []).map((k) => fieldLabels.get(k) ?? k);
        return (
          <Card key={i} className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-warning" />
                {cut.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {cut.scope.kind === 'INDIVIDUAL_AMBASSADOR'
                  ? 'Ranks individual ambassadors by registrations.'
                  : `Ranks groups by registrations, grouped by ${groupedBy.join(' + ') || '—'}.`}
              </p>
            </CardHeader>
            <CardContent className="space-y-1">
              {cut.ranks.length === 0 && <p className="text-sm text-muted-foreground">No prizes set.</p>}
              {cut.ranks.map((r, ri) => (
                <div key={ri} className="flex items-center justify-between gap-3 py-2 text-sm border-b border-border/40 last:border-0">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {rankLabel(r)}
                      {r.label && <span className="ml-2 font-normal text-muted-foreground">{r.label}</span>}
                    </div>
                    {r.goodie && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {r.goodie.imageUrl && <GoodieThumb goodie={r.goodie} size="xs" />}
                        <span>
                          {r.goodie.label}
                          {!!r.goodie.cashEquivalent && <> · worth ~<Rupees amount={r.goodie.cashEquivalent} /></>}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 font-medium">{r.cashAmount ? <Rupees amount={r.cashAmount} /> : '—'}</span>
                </div>
              ))}
              {cut.consolation && (
                <div className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-muted-foreground">Consolation · {cut.consolation.label}</span>
                  <span className="font-medium"><Rupees amount={cut.consolation.cashAmount} /></span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
