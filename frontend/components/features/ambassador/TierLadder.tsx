'use client';

import { useState } from 'react';
import { Check, Lock, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { onImageError } from '@/lib/utils/image';
import { Rupees } from './Rupees';
import type { CampaignStats, MilestoneTier } from '@/lib/types/ambassador';

interface TierLadderProps {
  milestoneTiers: MilestoneTier[];
  currentTier?: CampaignStats['currentTier'];
  nextTier?: CampaignStats['nextTier'];
  registrationCount?: number;
  /** Milestone brackets only (registrations x tier rate) — no speed bonus or leaderboard
   *  prize folded in. Those show up in the earnings breakdown modal instead. */
  milestoneAmount?: number;
  onOpenEarnings?: () => void;
  /** No personal stats yet (logged-out campaign preview, or not-yet-applied) — every tier
   *  renders as locked ("what you'll unlock") instead of "your progress", and the earnings
   *  footer (nothing to total yet) is swapped for an apply nudge. */
  preview?: boolean;
}

function tierRangeLabel(tier: MilestoneTier): string {
  return tier.maxRegistrations ? `${tier.minRegistrations}–${tier.maxRegistrations}` : `${tier.minRegistrations}+`;
}

/** Registrations still needed to finish (not just enter) this tier and actually win its
 *  goodie — e.g. a 1–25 tier at 20 registrations reads as 5 more (unlocks at 25, not 26).
 *  Null for an uncapped top tier, which has no ceiling to cross. */
function remainingToUnlock(tier: MilestoneTier, registrationCount: number): number | null {
  if (tier.maxRegistrations == null) return null;
  return Math.max(0, tier.maxRegistrations - registrationCount);
}

interface ExpandedTier {
  tier: MilestoneTier;
  isCurrent: boolean;
  isReached: boolean;
}

/** One ladder node — the tier's own goodie photo standing in for the old plain circle, shown
 *  at full clarity (not grayed out) at every stage so the reward stays a genuine, legible
 *  incentive instead of something the ambassador has to squint at. Locked/current/earned is
 *  communicated by the ring color and corner badge only, never by degrading the photo itself.
 *  Falls back to the old icon-only circle when a tier has no goodie image. Tapping a node with
 *  a photo opens the full-size view via `onExpand` — a real click target, not a hover-only
 *  affordance, since this is the page's main pre-application sales pitch. */
function TierNode({
  tier,
  isCurrent,
  isReached,
  size,
  onExpand,
}: {
  tier: MilestoneTier;
  isCurrent: boolean;
  isReached: boolean;
  size: 'sm' | 'lg';
  onExpand: (expanded: ExpandedTier) => void;
}) {
  const hasImage = !!tier.goodie?.imageUrl;
  const stateClass = isCurrent ? 'border-primary ring-[5px] ring-primary/15' : isReached ? 'border-chart-1 ring-[3px] ring-chart-1/15' : 'border-border';

  const circle = (
    <div className="relative shrink-0">
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-full border-[3px] bg-card font-bold transition-all',
          size === 'lg' ? 'h-20 w-20' : 'h-16 w-16',
          stateClass,
          !hasImage && (isCurrent ? 'text-primary' : isReached ? 'bg-chart-1 text-white' : 'text-muted-foreground'),
        )}
      >
        {hasImage ? (
          <Image src={tier.goodie!.imageUrl!} alt={tier.goodie!.label} fill sizes="80px" onError={onImageError} className="object-cover" />
        ) : isCurrent ? (
          <Star className="h-4 w-4 fill-current" />
        ) : isReached ? (
          <Check className="h-4 w-4" />
        ) : (
          <Lock className="h-3.5 w-3.5" />
        )}
      </div>
      {hasImage && (
        <span
          className={cn(
            'absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-card',
            size === 'lg' ? 'h-7 w-7' : 'h-6 w-6',
            isCurrent ? 'bg-primary text-primary-foreground animate-pulse-gentle' : isReached ? 'bg-chart-1 text-white' : 'bg-muted-foreground text-background',
          )}
        >
          {isCurrent ? <Star className="h-3.5 w-3.5 fill-current" /> : isReached ? <Check className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />}
        </span>
      )}
    </div>
  );

  if (!hasImage) return circle;

  return (
    <button
      type="button"
      onClick={() => onExpand({ tier, isCurrent, isReached })}
      className="group rounded-full transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`See ${tier.goodie!.label} for ${tier.label ?? 'this tier'}`}
    >
      {circle}
    </button>
  );
}

/** The reward path as a physical ladder — done/current/locked nodes on a connecting track,
 *  with the accrued total and what's next underneath — instead of a separate progress-bar
 *  card above it (ProgressCard) duplicating the same tier/registration numbers.
 *  RewardTiersCard (further down the page) still carries the full rate table; this is the
 *  at-a-glance version of the same data. Also renders in `preview` mode, with no personal
 *  stats, on the pre-application campaign page — same ladder, same goodie photos, just
 *  every node locked instead of showing real progress. */
export function TierLadder({
  milestoneTiers,
  currentTier,
  nextTier,
  registrationCount = 0,
  milestoneAmount = 0,
  onOpenEarnings,
  preview = false,
}: TierLadderProps) {
  const [expanded, setExpanded] = useState<ExpandedTier | null>(null);

  if (milestoneTiers.length === 0) return null;

  const ceiling = milestoneTiers.at(-1)?.maxRegistrations ?? milestoneTiers.at(-1)?.minRegistrations ?? 1;
  const trackPercent = preview ? 0 : Math.min(100, Math.round((registrationCount / Math.max(1, ceiling)) * 100));

  // A tier's goodie is only actually won once its bracket is finished (registrations reach
  // its max, e.g. 25 for a 1–25 tier) — being "current" (inside the bracket, still climbing
  // it) is not the same as having earned it, even though both used to render identically as
  // soon as the count hit the tier's floor. An uncapped top tier (maxRegistrations null)
  // never flips to "earned" since there's no ceiling to reach; it just stays current.
  const isTierReached = (tier: MilestoneTier) =>
    !preview && tier.maxRegistrations != null && registrationCount >= tier.maxRegistrations;
  // At the exact boundary count (registrationCount === tier.maxRegistrations), the backend's
  // currentTier can still name this bracket (registrationCount sits inclusively at its top
  // edge) even though it's just been earned — `isReached` wins that tie so the node shows as
  // unlocked, not "still in progress".
  const isTierCurrent = (tier: MilestoneTier) =>
    !preview && currentTier?.minRegistrations === tier.minRegistrations && !isTierReached(tier);

  return (
    <Card className="border-border/50">
      <CardContent>
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
              {preview ? "What you'll unlock" : 'Your progress'}
            </p>
            <h3 className="text-base font-bold text-foreground">Reward tier ladder</h3>
          </div>
          {!preview && (
            <p className="text-xl font-bold text-foreground tabular-nums">
              {registrationCount}
              <span className="text-xs font-medium text-muted-foreground ml-1">registrations</span>
            </p>
          )}
        </div>

        {/* Below `lg`: a horizontal scroll-snap row of full-size nodes — a tier count past
            ~4 has no room to compress into on a phone without the circles overlapping, so
            this scrolls instead of shrinking. */}
        <div className="lg:hidden -mx-1 overflow-x-auto pb-1" style={{ scrollSnapType: 'x proximity' }}>
          <div className="flex gap-5 px-1 pt-1">
            {milestoneTiers.map((tier, i) => {
              const isCurrent = isTierCurrent(tier);
              const isReached = isTierReached(tier);
              const isFirst = i === 0;
              const isLast = i === milestoneTiers.length - 1;
              return (
                <div
                  key={i}
                  className="relative flex w-20 shrink-0 flex-col items-center gap-2 text-center"
                  style={{ scrollSnapAlign: 'center' }}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-[31px] -z-10 h-[3px] rounded-full',
                      isReached || isCurrent ? 'bg-gradient-to-r from-chart-1 to-chart-2' : 'bg-secondary'
                    )}
                    style={{
                      left: isFirst ? '50%' : '-10px',
                      width: isFirst || isLast ? 'calc(50% + 10px)' : 'calc(100% + 20px)',
                    }}
                  />
                  <TierNode tier={tier} isCurrent={isCurrent} isReached={isReached} size="sm" onExpand={setExpanded} />
                  <div>
                    <p className={`text-xs font-bold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>{tier.label ?? `Level ${i + 1}`}</p>
                    <p className="text-[10.5px] text-muted-foreground tabular-nums">{tierRangeLabel(tier)}</p>
                    <p className="text-[10.5px] text-muted-foreground tabular-nums">₹{tier.amountPerRegistration}/reg</p>
                    {isCurrent && (
                      <p className="text-[9px] font-bold uppercase tracking-wide text-primary mt-0.5">
                        {(() => {
                          const remaining = remainingToUnlock(tier, registrationCount);
                          return remaining != null
                            ? `${remaining} more to unlock ${tier.label ?? `Level ${i + 1}`}`
                            : "You're here";
                        })()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden lg:block relative pt-1">
          <div className="absolute top-[40px] left-[40px] right-[40px] h-[3px] rounded-full bg-secondary" />
          <div
            className="absolute top-[40px] left-[40px] h-[3px] rounded-full bg-gradient-to-r from-chart-1 to-chart-2 transition-all duration-700"
            style={{ width: `calc(${trackPercent}% - 40px)`, maxWidth: 'calc(100% - 80px)' }}
          />
          <div className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${milestoneTiers.length}, minmax(0, 1fr))` }}>
            {milestoneTiers.map((tier, i) => {
              const isCurrent = isTierCurrent(tier);
              const isReached = isTierReached(tier);
              return (
                <div key={i} className="flex flex-col items-center text-center gap-2">
                  <TierNode tier={tier} isCurrent={isCurrent} isReached={isReached} size="lg" onExpand={setExpanded} />
                  <div>
                    <p className={`text-xs font-bold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>{tier.label ?? `Level ${i + 1}`}</p>
                    <p className="text-[10.5px] text-muted-foreground tabular-nums">{tierRangeLabel(tier)}</p>
                    <p className="text-[10.5px] text-muted-foreground tabular-nums">₹{tier.amountPerRegistration}/reg</p>
                    {isCurrent && (
                      <p className="text-[9px] font-bold uppercase tracking-wide text-primary mt-0.5">
                        {(() => {
                          const remaining = remainingToUnlock(tier, registrationCount);
                          return remaining != null
                            ? `${remaining} more to unlock ${tier.label ?? `Level ${i + 1}`}`
                            : "You're here";
                        })()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 flex-wrap pt-6 mt-6 border-t border-border/60">
          {preview ? (
            <p className="text-xs text-muted-foreground max-w-[60%]">
              Apply to start climbing — your first referral counts toward Level 1.
            </p>
          ) : nextTier ? (
            <p className="text-xs text-muted-foreground max-w-[60%]">
              {Math.max(0, nextTier.minRegistrations - registrationCount)} more registration{Math.max(0, nextTier.minRegistrations - registrationCount) === 1 ? '' : 's'} →{' '}
              {nextTier.label ?? 'next tier'} (<Rupees amount={nextTier.amountPerRegistration} />
              /registration)
            </p>
          ) : currentTier ? (
            <p className="text-xs text-muted-foreground max-w-[60%]">You&apos;ve reached the top tier</p>
          ) : (
            <span />
          )}
          {!preview && (
            <div className="text-right ml-auto">
              <p className="text-2xl font-bold text-foreground tabular-nums">
                <Rupees amount={milestoneAmount} />
              </p>
              {onOpenEarnings && (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs font-semibold" onClick={onOpenEarnings}>
                  See your total earnings
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={!!expanded} onOpenChange={(open) => !open && setExpanded(null)}>
        <DialogContent className="sm:max-w-sm w-full max-w-[calc(100vw-2rem)]">
          {expanded && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold pr-6">{expanded.tier.goodie!.label}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-border/50 bg-accent/10">
                  <Image src={expanded.tier.goodie!.imageUrl!} alt={expanded.tier.goodie!.label} fill sizes="(max-width: 480px) 100vw, 380px" onError={onImageError} className="object-cover" />
                  {!!expanded.tier.goodie!.cashEquivalent && (
                    <span className="absolute top-3 right-3 rounded-full bg-background/90 border border-border/50 px-2.5 py-1 text-xs font-semibold shadow-sm">
                      Worth ~<Rupees amount={expanded.tier.goodie!.cashEquivalent} />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {expanded.tier.label ?? 'Tier'} · {tierRangeLabel(expanded.tier)} registrations
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Rupees amount={expanded.tier.amountPerRegistration} />
                    /registration at this tier
                  </p>
                </div>
                <p
                  className={cn(
                    'text-xs font-semibold rounded-lg px-3 py-2.5',
                    expanded.isReached ? 'bg-chart-1/10 text-chart-1' : expanded.isCurrent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {expanded.isReached
                    ? "Unlocked — you've already earned this one."
                    : expanded.isCurrent
                      ? (() => {
                        const remaining = remainingToUnlock(expanded.tier, registrationCount);
                        return remaining != null
                          ? `${remaining} more registration${remaining === 1 ? '' : 's'} to unlock this reward.`
                          : "You're on this tier now.";
                      })()
                      : preview
                        ? `Unlocks once you complete this tier (${tierRangeLabel(expanded.tier)} registrations).`
                        : `Unlocks at ${expanded.tier.minRegistrations}+ registrations.`}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
