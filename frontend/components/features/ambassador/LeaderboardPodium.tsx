'use client';

import { cn } from '@/lib/utils';
import type { LeaderboardEntryResult, LeaderboardScope } from '@/lib/types/ambassador';

const SPOT_STYLE: Record<number, string> = {
  1: 'order-2 pt-5 bg-warning/15 border-warning/40',
  2: 'order-1 border-border/50',
  3: 'order-3 border-border/50',
};

/** Top-3 podium for a leaderboard scope — #1 raised and highlighted, #2/#3 flanking it.
 *  Ranks 4+ stay in the plain table below (see LeaderboardTable). */
export function LeaderboardPodium({
  rows,
  scope,
  currentAmbassadorId,
}: {
  rows: LeaderboardEntryResult[];
  scope: LeaderboardScope;
  currentAmbassadorId?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2.5 items-end mb-4">
      {rows.map((row) => {
        const isYou = scope.kind === 'INDIVIDUAL_AMBASSADOR' && row.groupKey === currentAmbassadorId;
        return (
          <div
            key={row.groupKey}
            className={cn('rounded-lg border text-center px-2 py-3.5', SPOT_STYLE[row.rank] ?? 'order-4 border-border/50')}
          >
            <p className="text-xs font-bold text-muted-foreground">#{row.rank}</p>
            <p className="text-sm font-bold text-foreground truncate mt-1.5">
              {row.label}
              {isYou && <span className="ml-1.5 text-xs font-semibold text-primary">You</span>}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{row.registrationCount} regs</p>
          </div>
        );
      })}
    </div>
  );
}
