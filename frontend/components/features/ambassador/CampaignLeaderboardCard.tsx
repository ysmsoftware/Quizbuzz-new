'use client';

import { Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAmbassadorCampaignLeaderboard } from '@/lib/hooks/useAmbassadorCampaignStats';
import { LeaderboardChart } from './LeaderboardChart';
import { LeaderboardTable } from './LeaderboardTable';
import { Rupees } from './Rupees';
import type { LeaderboardCut, LeaderboardRankReward, MilestoneTier } from '@/lib/types/ambassador';

function rankLabel(r: LeaderboardRankReward): string {
  if (r.rankRange) return `Rank ${r.rankRange[0]}–${r.rankRange[1]}`;
  if (r.rank) return `Rank ${r.rank}`;
  return r.label ?? 'Winner';
}

/** "the department leaderboard" vs "this college leaderboard" — a label that's already named
 *  "X Leaderboard" reads oddly with a second "leaderboard" tacked on. */
function populateNoun(label: string): string {
  return /leaderboard$/i.test(label) ? `this ${label.toLowerCase()}` : `the ${label.toLowerCase()} leaderboard`;
}

const PRIZE_BAR_COLOR = ['bg-warning', 'bg-muted-foreground/50', 'bg-secondary-foreground/40'];

/** Before anyone's registered, there's nothing to chart yet — so instead of a blank "no
 *  rankings" box, this bars out what each rank is worth, the same visual language the real
 *  LeaderboardChart uses once there's data to show (registration counts) to replace. */
function PrizePreviewChart({ cut }: { cut: LeaderboardCut }) {
  const items = [
    ...cut.ranks.map((r) => ({ key: rankLabel(r), amount: r.cashAmount ?? r.goodie?.cashEquivalent ?? 0, fallback: r.goodie?.label ?? r.label })),
    ...(cut.consolation ? [{ key: cut.consolation.label, amount: cut.consolation.cashAmount, fallback: undefined }] : []),
  ];
  const max = Math.max(1, ...items.map((i) => i.amount));

  return (
    <div className="flex items-end gap-3 h-[120px] pt-2">
      {items.map((item, i) => (
        <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
          <span className="mb-1 max-w-full truncate text-[11px] font-bold text-foreground">
            {item.amount > 0 ? <Rupees amount={item.amount} /> : (item.fallback ?? '—')}
          </span>
          <div
            className={cn('w-full rounded-t-md', PRIZE_BAR_COLOR[i] ?? 'bg-secondary-foreground/25')}
            style={{ height: `${Math.max(14, (item.amount / max) * 100)}%` }}
          />
          <span className="mt-1.5 max-w-full truncate text-center text-[10px] text-muted-foreground">{item.key}</span>
        </div>
      ))}
    </div>
  );
}

interface CampaignLeaderboardCardProps {
  campaignId: string;
  /** The full cut config (scope + label + its rank→prize schedule), not just what to fetch
   *  rows for — the prize strip below reads straight off cut.ranks/consolation, so what's up
   *  for grabs is visible before anyone actually occupies a paid rank. */
  cut: LeaderboardCut;
  /** This ambassador's own rank within this scope (from stats.leaderboardRanks), or null if
   *  they don't have one yet (e.g. zero registrations, or not yet approved on the campaign). */
  ownRank: number | null;
  currentAmbassadorId?: string;
  /** See LeaderboardChart — pass only for the individual-ambassador scope. */
  tierTicks?: MilestoneTier[];
}

/** One leaderboard cut, as its own card: what it pays, then a bar chart plus a short ranked
 *  list underneath. Fetches its own rows (a component per scope, not a loop of hook calls in
 *  the parent) so a campaign with any number of configured leaderboard cuts can render all of
 *  them at once, side by side, instead of one at a time behind a tab switcher. */
export function CampaignLeaderboardCard({ campaignId, cut, ownRank, currentAmbassadorId, tierTicks }: CampaignLeaderboardCardProps) {
  const { scope, label } = cut;
  const { rows, pagination, isLoading } = useAmbassadorCampaignLeaderboard(campaignId, scope, { limit: 10 });
  const hasPrizes = cut.ranks.length > 0 || !!cut.consolation;

  return (
    <Card className="border-border/50">
      <CardContent className="pt-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-[13px] font-bold text-foreground leading-snug">{label}</h3>
            {ownRank !== null && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Your rank: <span className="font-semibold text-primary">#{ownRank}</span>
                {pagination?.total ? ` of ${pagination.total}` : ''}
              </p>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-secondary rounded-full px-2 py-1 shrink-0 whitespace-nowrap">
            <Trophy className="h-3 w-3" />
            Top 5
          </span>
        </div>

        {isLoading ? (
          <Skeleton className="h-[180px] w-full rounded-lg mt-4" />
        ) : rows.length === 0 ? (
          hasPrizes ? (
            <div className="pt-1">
              <PrizePreviewChart cut={cut} />
              <p className="mt-3 border-t border-border/60 pt-3 text-center text-xs text-muted-foreground">
                No one&apos;s ranked yet — registrations will fill in {populateNoun(label)}.
              </p>
            </div>
          ) : (
            <Empty className="py-8">
              <EmptyMedia variant="icon">
                <Trophy className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle className="text-sm">No rankings yet</EmptyTitle>
              <EmptyDescription className="text-xs">Registrations will populate {populateNoun(label)}.</EmptyDescription>
            </Empty>
          )
        ) : (
          <>
            <LeaderboardChart rows={rows} ownRank={ownRank} tierTicks={tierTicks} />
            <div className="mt-3 pt-3.5 border-t border-border/60">
              <LeaderboardTable scope={scope} label={label} rows={rows.slice(0, 5)} currentAmbassadorId={currentAmbassadorId} isLoading={false} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
