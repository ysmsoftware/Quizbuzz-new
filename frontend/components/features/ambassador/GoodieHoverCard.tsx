'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { onImageError } from '@/lib/utils/image';
import { Rupees } from './Rupees';

interface Goodie {
  label: string;
  cashEquivalent?: number;
  imageUrl?: string;
}

/** Full-detail hover popover for a reward goodie (milestone tier / speed bonus tier /
 *  leaderboard rank) — bigger image with the worth badge overlaid, name, and worth. Wraps
 *  whatever row/card already shows the goodie's small inline thumbnail+label; matches the
 *  contest-prize hover pattern (ContestPrizeBracket.tsx / contest-details.tsx) so the same
 *  interaction is consistent everywhere a goodie is shown. Renders nothing if there's no
 *  goodie to describe — callers only wrap with this when `tier.goodie` is set. */
export function GoodieHoverCard({ goodie, children }: { goodie: Goodie; children: ReactNode }) {
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-72" align="start">
        <div className="space-y-3">
          {goodie.imageUrl && (
            <div className="relative w-full h-44">
              <Image src={goodie.imageUrl} alt="" fill sizes="288px" onError={onImageError} className="object-cover rounded-md border border-border/50" />
              {!!goodie.cashEquivalent && (
                <span className="absolute top-2 right-2 rounded-full border border-border/50 bg-background/90 px-2 py-1 text-xs font-semibold shadow-sm">
                  Worth ~<Rupees amount={goodie.cashEquivalent} />
                </span>
              )}
            </div>
          )}
          <div>
            <p className="font-semibold text-base">{goodie.label}</p>
            {!!goodie.cashEquivalent && !goodie.imageUrl && (
              <p className="text-sm text-muted-foreground">
                Worth ~<Rupees amount={goodie.cashEquivalent} />
              </p>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
