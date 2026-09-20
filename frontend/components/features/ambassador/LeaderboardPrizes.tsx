'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { onImageError } from '@/lib/utils/image';
import { Rupees } from './Rupees';
import type { LeaderboardCut, LeaderboardRankReward } from '@/lib/types/ambassador';

const COLLAPSED_COUNT = 6;

const startRank = (r: LeaderboardRankReward) => r.rank ?? r.rankRange?.[0] ?? Number.MAX_SAFE_INTEGER;

const rankText = (r: LeaderboardRankReward) =>
  r.rankRange ? `Ranks ${r.rankRange[0]}–${r.rankRange[1]}` : r.rank ? `Rank ${r.rank}` : 'Winner';

// Gold / silver / bronze-ish for the podium, neutral after that.
function badgeClass(rank: number) {
  if (rank === 1) return 'bg-warning text-warning-foreground';
  if (rank === 2) return 'bg-muted-foreground/25 text-foreground';
  if (rank === 3) return 'bg-secondary-foreground/20 text-foreground';
  return 'bg-secondary text-muted-foreground';
}

interface PrizeTileProps {
  badge: string;
  badgeRank: number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  cash?: number;
  worth?: number;
  isYou?: boolean;
}

function PrizeTile({ badge, badgeRank, title, subtitle, imageUrl, cash, worth, isYou }: PrizeTileProps) {
  return (
    <div className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card', isYou && 'ring-2 ring-primary')}>
      <div className="relative aspect-square w-full bg-accent/10">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill sizes="(min-width: 640px) 160px, 45vw" loading="lazy" onError={onImageError} className="object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-warning/20">
              <Trophy className="size-7 text-warning" />
            </span>
          </div>
        )}
        <span className={cn('absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm', badgeClass(badgeRank))}>{badge}</span>
        {isYou && <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">You</span>}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">{title}</p>
        {subtitle && <p className="line-clamp-1 text-[11px] text-muted-foreground">{subtitle}</p>}
        {!!cash && (
          <p className="mt-auto pt-1 text-sm font-bold text-foreground">
            <Rupees amount={cash} />
          </p>
        )}
        {!!worth && <p className="text-[11px] text-muted-foreground">Worth ~<Rupees amount={worth} /></p>}
      </div>
    </div>
  );
}

/** What each rank of a leaderboard wins — read straight off the configured cut, so every
 *  prize shows whether or not anyone occupies that rank yet (unlike the standings, which only
 *  list people who have registrations). A prize with a photo shows it large; without one it
 *  falls back to a trophy. `ownRank` highlights the prize the viewer is currently in line for. */
export function LeaderboardPrizes({ cut, ownRank }: { cut: LeaderboardCut; ownRank?: number | null }) {
  const [showAll, setShowAll] = useState(false);
  const ranks = [...cut.ranks].sort((a, b) => startRank(a) - startRank(b));
  const total = ranks.length + (cut.consolation ? 1 : 0);
  if (total === 0) return null;

  const visible = showAll ? ranks : ranks.slice(0, COLLAPSED_COUNT);
  const hiddenCount = ranks.length - visible.length;

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What each rank wins</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {visible.map((r, i) => {
          const from = startRank(r);
          const to = r.rankRange?.[1] ?? from;
          return (
            <PrizeTile
              key={i}
              badge={rankText(r)}
              badgeRank={from}
              title={r.goodie?.label ?? r.label ?? (r.cashAmount ? 'Cash prize' : 'Winner')}
              subtitle={r.goodie && r.label ? r.label : undefined}
              imageUrl={r.goodie?.imageUrl}
              cash={r.cashAmount}
              worth={r.goodie?.cashEquivalent}
              isYou={!!ownRank && ownRank >= from && ownRank <= to}
            />
          );
        })}
        {(showAll || hiddenCount === 0) && cut.consolation && (
          <PrizeTile badge="Consolation" badgeRank={Number.MAX_SAFE_INTEGER} title={cut.consolation.label} cash={cut.consolation.cashAmount} />
        )}
      </div>
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setShowAll(true)} className="mt-2.5 text-xs font-semibold text-primary hover:underline">
          Show all {total} prizes
        </button>
      )}
    </div>
  );
}
