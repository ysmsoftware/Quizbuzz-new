'use client';

import { Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useAmbassadorCampaignLeaderboard } from '@/lib/hooks/useAmbassadorCampaignStats';
import { LeaderboardChart } from './LeaderboardChart';
import { LeaderboardTable } from './LeaderboardTable';
import type { LeaderboardScope, MilestoneTier } from '@/lib/types/ambassador';

interface CampaignLeaderboardCardProps {
  campaignId: string;
  scope: LeaderboardScope;
  label: string;
  /** This ambassador's own rank within this scope (from stats.leaderboardRanks), or null if
   *  they don't have one yet (e.g. zero registrations). */
  ownRank: number | null;
  currentAmbassadorId?: string;
  /** See LeaderboardChart — pass only for the individual-ambassador scope. */
  tierTicks?: MilestoneTier[];
}

/** One leaderboard cut, as its own card: a bar chart plus a short ranked list underneath.
 *  Fetches its own rows (a component per scope, not a loop of hook calls in the parent) so
 *  a campaign with any number of configured leaderboard cuts can render all of them at once,
 *  side by side, instead of one at a time behind a tab switcher. */
export function CampaignLeaderboardCard({ campaignId, scope, label, ownRank, currentAmbassadorId, tierTicks }: CampaignLeaderboardCardProps) {
  const { rows, pagination, isLoading } = useAmbassadorCampaignLeaderboard(campaignId, scope, { limit: 10 });

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
          <Empty className="py-8">
            <EmptyMedia variant="icon">
              <Trophy className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle className="text-sm">No rankings yet</EmptyTitle>
            <EmptyDescription className="text-xs">Registrations will populate the {label.toLowerCase()} leaderboard.</EmptyDescription>
          </Empty>
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
