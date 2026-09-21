'use client';

import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { onImageError } from '@/lib/utils/image';
import { Rupees } from './Rupees';
import type { CampaignStats, MilestoneTier } from '@/lib/types/ambassador';
import { tierRangePhrase, unlockPhrase } from '@/lib/utils/milestone-tiers';

export interface ExpandedTier {
  tier: MilestoneTier;
  isCurrent: boolean;
  isReached: boolean;
}

/** Registrations still needed to finish (not just enter) this tier and actually win its
 *  goodie — e.g. a 1–25 tier at 20 registrations reads as 5 more (unlocks at 25, not 26).
 *  Null for an uncapped top tier, which has no ceiling to cross. */
export function remainingToUnlock(tier: MilestoneTier, registrationCount: number): number | null {
  if (tier.maxRegistrations == null) return null;
  return Math.max(0, tier.maxRegistrations - registrationCount);
}

/** A tier's goodie is only actually won once its bracket is finished (registrations reach its
 *  max, e.g. 25 for a 1–25 tier) — being "current" (inside the bracket, still climbing it) is
 *  not the same as having earned it. An uncapped top tier (maxRegistrations null) never flips
 *  to "earned" since there's no ceiling to reach; it just stays current. At the exact boundary
 *  count the backend's currentTier can still name this bracket, so `isReached` wins that tie. */
export function getTierStatus(
  tier: MilestoneTier,
  { currentTier, registrationCount, preview }: { currentTier?: CampaignStats['currentTier']; registrationCount: number; preview: boolean },
) {
  const isReached = !preview && tier.maxRegistrations != null && registrationCount >= tier.maxRegistrations;
  const isCurrent = !preview && currentTier?.minRegistrations === tier.minRegistrations && !isReached;
  return { isCurrent, isReached };
}

/** Full-size view of a tier's goodie — a real click target on every screen, so the reward is
 *  reachable on touch devices where hover cards never open. Shared by the tier ladder and the
 *  reward-tier list. */
export function TierGoodieDialog({
  expanded,
  registrationCount,
  preview,
  onClose,
}: {
  expanded: ExpandedTier | null;
  registrationCount: number;
  preview: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!expanded} onOpenChange={(open) => !open && onClose()}>
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
                  {expanded.tier.label ?? 'Tier'} · {tierRangePhrase(expanded.tier)}
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
                      ? `Unlocks once you complete this tier (${tierRangePhrase(expanded.tier)}).`
                      : `${unlockPhrase(expanded.tier)}.`}
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
