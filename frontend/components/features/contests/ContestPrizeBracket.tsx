'use client';

import { Trophy, Medal, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Contest } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import Image from 'next/image';
import { onImageError } from '@/lib/utils/image';

interface PrizeBracketProps {
  prizes: Contest['prizes'];
  className?: string;
}

type PrizeItem = NonNullable<Contest['prizes']>[number];

function rankLabel(prize: PrizeItem): string {
  if (prize.label) return prize.label;
  return prize.rankFrom === prize.rankTo ? `Rank ${prize.rankFrom}` : `Rank ${prize.rankFrom}-${prize.rankTo}`;
}

function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString()}`;
}

/** Full-detail popover for a prize bracket's goodie — image, cash prize, benefits, and the
 *  goodie's own worth. Shared by both the podium cards and the 4th+ table below. */
function PrizeDetailsHoverCard({ prize, worth, children }: { prize: PrizeItem; worth: string | null; children: React.ReactNode }) {
  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="space-y-3">
          {prize.goodieImageUrl && (
            <div className="relative w-full h-52">
              <Image
                src={prize.goodieImageUrl}
                alt=""
                fill
                sizes="320px"
                onError={onImageError}
                className="object-cover rounded-md border border-border/50"
              />
              {worth && (
                <span className="absolute top-2 right-2 rounded-full border border-border/50 bg-background/90 px-2 py-1 text-xs font-semibold shadow-sm">
                  Worth ~{worth}
                </span>
              )}
            </div>
          )}
          <div>
            <p className="font-semibold text-base">{prize.label || rankLabel(prize)}</p>
            {Number(prize.amount) > 0 && (
              <p className="text-sm font-semibold text-primary">Cash prize: {formatMoney(Number(prize.amount))}</p>
            )}
          </div>
          {prize.benefits && prize.benefits.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Benefits</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                {prize.benefits.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </div>
          )}
          {prize.goodieLabel && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Goodie</p>
              <p className="text-sm font-medium">
                {prize.goodieLabel}
                {worth && !prize.goodieImageUrl && ` (Worth ~${worth})`}
              </p>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function ContestPrizeBracket({ prizes, className }: PrizeBracketProps) {
  if (!prizes || prizes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
        <Award className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">No prize structure defined for this contest.</p>
      </div>
    );
  }

  const sortedPrizes = [...prizes].sort((a, b) => a.rankFrom - b.rankFrom);
  // A bracket is "podium" when its range reaches into the top 3 (e.g. rankFrom=1,rankTo=3
  // covers all three podium spots; rankFrom=4,rankTo=10 does not).
  const podiumPrizes = sortedPrizes.filter(p => p.rankFrom <= 3);
  const otherPrizes = sortedPrizes.filter(p => p.rankFrom > 3);

  // One slot per podium rank (1/2/3), each filled by whichever bracket covers that rank and
  // hasn't already filled an earlier slot — a bracket spanning multiple podium ranks (e.g.
  // "1st-3rd") fills only its lowest rank's slot, so the same prize never renders twice
  // (which would otherwise produce duplicate React keys).
  const shownPrizeIds = new Set<string>();
  const podiumSlot = (rank: number) => {
    const prize = podiumPrizes.find(p => p.rankFrom <= rank && rank <= p.rankTo && !shownPrizeIds.has(p.id));
    if (prize) shownPrizeIds.add(prize.id);
    return prize;
  };
  const [slot1, slot2, slot3] = [podiumSlot(1), podiumSlot(2), podiumSlot(3)];
  // Visual podium order: 2nd, 1st, 3rd.
  const displayPodium = [slot2, slot1, slot3];

  return (
    <div className={cn("space-y-8", className)}>
      {/* Podium Display */}
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-6 pt-10">
        {displayPodium.map((prize, index) => {
          if (!prize) return <div key={index} />;

          const isFirst = prize.rankFrom <= 1 && prize.rankTo >= 1 && index === 1;
          const isThird = index === 2;
          const worth = prize.goodieCashEquivalent != null && Number(prize.goodieCashEquivalent) > 0
            ? formatMoney(Number(prize.goodieCashEquivalent))
            : null;
          const hasGoodie = !!(prize.goodieLabel || prize.goodieImageUrl);

          const card = (
            <div className={cn(
              "relative flex flex-col items-center w-full rounded-t-2xl pt-8 pb-6 px-2 text-center",
              isFirst ? "bg-primary/10 border-x-2 border-t-2 border-primary/20 h-48" :
              !isThird ? "bg-muted/50 border-x border-t border-border/50 h-40" :
              "bg-muted/30 border-x border-t border-border/30 h-32"
            )}>
              <div className={cn(
                "absolute -top-10 flex h-14 w-14 items-center justify-center rounded-full shadow-lg border-4 border-background overflow-hidden",
                isFirst ? "bg-yellow-500" : !isThird ? "bg-slate-400" : "bg-amber-600"
              )}>
                {prize.goodieImageUrl ? (
                  <Image src={prize.goodieImageUrl} alt="" fill sizes="56px" onError={onImageError} className="rounded-full object-cover" />
                ) : isFirst ? (
                  <Trophy className="h-7 w-7 text-white" />
                ) : (
                  <Medal className="h-7 w-7 text-white" />
                )}
              </div>

              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                {rankLabel(prize)}
              </span>
              <span className={cn(
                "font-bold truncate w-full px-2",
                isFirst ? "text-xl sm:text-2xl text-primary" : "text-lg text-foreground"
              )}>
                {Number(prize.amount) > 0 ? formatMoney(Number(prize.amount)) : (prize.label || rankLabel(prize))}
              </span>
              {(prize.goodieLabel || (prize.benefits && prize.benefits.length > 0)) && (
                <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2">
                  {prize.goodieLabel || prize.benefits?.join(', ')}
                  {prize.goodieLabel && worth && ` (Worth ~${worth})`}
                </span>
              )}
            </div>
          );

          return (
            <motion.div
              key={prize.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center"
            >
              {hasGoodie ? (
                <PrizeDetailsHoverCard prize={prize} worth={worth}>
                  <div className="w-full cursor-default">{card}</div>
                </PrizeDetailsHoverCard>
              ) : card}
            </motion.div>
          );
        })}
      </div>

      {/* Table Display for 4th+ */}
      {otherPrizes.length > 0 && (
        <Card className="overflow-hidden border-border/50">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-20">Rank</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reward</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Goodie</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Benefits</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {otherPrizes.map((prize) => {
                  const worth = prize.goodieCashEquivalent != null && Number(prize.goodieCashEquivalent) > 0
                    ? formatMoney(Number(prize.goodieCashEquivalent))
                    : null;
                  const hasGoodie = !!(prize.goodieLabel || prize.goodieImageUrl);
                  const hasBenefits = !!(prize.benefits && prize.benefits.length > 0);

                  const row = (
                    <tr key={prize.id} className={cn('transition-colors', (hasGoodie || hasBenefits) && 'hover:bg-muted/20 cursor-default')}>
                      <td className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">
                        {prize.rankFrom === prize.rankTo ? prize.rankFrom : `${prize.rankFrom}-${prize.rankTo}`}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {Number(prize.amount) > 0 ? formatMoney(Number(prize.amount)) : (prize.label || '—')}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {hasGoodie ? (
                          <span className="flex items-center gap-2">
                            {prize.goodieImageUrl && (
                              <span className="relative inline-block h-6 w-6 shrink-0">
                                <Image src={prize.goodieImageUrl} alt="" fill sizes="24px" onError={onImageError} className="rounded object-cover border border-border/50" />
                              </span>
                            )}
                            <span className="font-medium text-foreground">
                              {prize.goodieLabel}
                              {worth && ` (Worth ~${worth})`}
                            </span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {hasBenefits ? (
                          <ul className="list-disc list-inside space-y-0.5">
                            {prize.benefits!.map((b) => <li key={b}>{b}</li>)}
                          </ul>
                        ) : '—'}
                      </td>
                    </tr>
                  );

                  return (hasGoodie || hasBenefits) ? (
                    <PrizeDetailsHoverCard key={prize.id} prize={prize} worth={worth}>{row}</PrizeDetailsHoverCard>
                  ) : row;
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
