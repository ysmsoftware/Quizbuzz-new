'use client';

import { useState } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useAmbassadorCampaignLeaderboard } from '@/lib/hooks/useAmbassadorCampaignStats';
import { LeaderboardChart } from './LeaderboardChart';
import { LeaderboardTable } from './LeaderboardTable';
import { LeaderboardPrizes } from './LeaderboardPrizes';
import { leaderboardScopeKey, type LeaderboardCut, type MilestoneTier } from '@/lib/types/ambassador';

/** "the department leaderboard" vs "this college leaderboard" — a label that's already named
 *  "X Leaderboard" reads oddly with a second "leaderboard" tacked on. */
function populateNoun(label: string): string {
  return /leaderboard$/i.test(label) ? `this ${label.toLowerCase()}` : `the ${label.toLowerCase()} leaderboard`;
}

/** A cut that's scoped to (depends on) another cut's own field — e.g. Department, scoped to
 *  this ambassador's College. Nested under its parent's card instead of shown separately. */
export interface NestedLeaderboardCut {
  cut: LeaderboardCut;
  ownRank: number | null;
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
  /** Cuts scoped to this one's field (e.g. Department scoped to this College cut) — rendered
   *  collapsed behind a "View X" toggle instead of as their own top-level card, since an
   *  ambassador only ever has the one value here to drill into. Omit for a nested card itself
   *  (one level of nesting only). */
  nestedCuts?: NestedLeaderboardCut[];
  /** True when this card is being rendered inside another card's expand panel — swaps the
   *  bordered Card shell for a flatter inline block so cards don't nest visually inside cards. */
  nested?: boolean;
}

/** One leaderboard cut, as its own card: what it pays, then a bar chart plus a short ranked
 *  list underneath. Fetches its own rows (a component per scope, not a loop of hook calls in
 *  the parent) so a campaign with any number of configured leaderboard cuts can render all of
 *  them at once, side by side, instead of one at a time behind a tab switcher. */
export function CampaignLeaderboardCard({ campaignId, cut, ownRank, currentAmbassadorId, tierTicks, nestedCuts, nested }: CampaignLeaderboardCardProps) {
  const { scope, label } = cut;
  const { rows, pagination, isLoading } = useAmbassadorCampaignLeaderboard(campaignId, scope, { limit: 20 });
  const hasPrizes = cut.ranks.length > 0 || !!cut.consolation;
  const [expanded, setExpanded] = useState(false);

  const body = (
    <>
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
          Standings
        </span>
      </div>

      {hasPrizes && (
        <div className="mb-4 border-b border-border/60 pb-4">
          <LeaderboardPrizes cut={cut} ownRank={ownRank} />
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-[180px] w-full rounded-lg mt-4" />
      ) : rows.length === 0 ? (
        hasPrizes ? (
          <p className="pt-1 text-center text-xs text-muted-foreground">
            No one&apos;s ranked yet — registrations will fill in {populateNoun(label)}.
          </p>
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
          <div className="mt-3 pt-3.5 border-t border-border/60 min-w-0">
            <LeaderboardTable scope={scope} label={label} rows={rows} currentAmbassadorId={currentAmbassadorId} isLoading={false} />
          </div>
        </>
      )}

      {nestedCuts && nestedCuts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <span className="text-[12px] font-semibold text-primary">
              View {nestedCuts.length === 1 ? nestedCuts[0]!.cut.label : `${nestedCuts.length} more leaderboards`}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      )}
    </>
  );

  if (nested) {
    return <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 sm:p-4 min-w-0 overflow-hidden">{body}</div>;
  }

  return (
    <>
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="pt-1">{body}</CardContent>
      </Card>

      {nestedCuts && nestedCuts.length > 0 && (
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent className="sm:max-w-xl md:max-w-2xl w-full max-w-[calc(100vw-1.5rem)] max-h-[88vh] overflow-y-auto p-4 sm:p-6 min-w-0">
            <DialogHeader className="pb-1">
              <DialogTitle className="text-base sm:text-lg font-bold">{nestedCuts.length === 1 ? nestedCuts[0]!.cut.label : `${label} — Leaderboards`}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              {nestedCuts.map((child) => (
                <CampaignLeaderboardCard
                  key={leaderboardScopeKey(child.cut.scope)}
                  campaignId={campaignId}
                  cut={child.cut}
                  ownRank={child.ownRank}
                  currentAmbassadorId={currentAmbassadorId}
                  nested
                />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
