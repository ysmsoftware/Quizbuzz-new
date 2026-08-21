'use client';

import { Check, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Rupees } from './Rupees';
import type { CampaignStats, MilestoneTier } from '@/lib/types/ambassador';

interface TierLadderProps {
  milestoneTiers: MilestoneTier[];
  currentTier: CampaignStats['currentTier'];
  nextTier: CampaignStats['nextTier'];
  registrationCount: number;
  accruedAmount: number;
}

/** The reward path as a physical ladder — done/current/locked nodes on a connecting track,
 *  with the accrued total and what's next underneath — instead of a separate progress-bar
 *  card above it (ProgressCard) duplicating the same tier/registration numbers.
 *  RewardTiersCard (further down the page) still carries the full rate table; this is the
 *  at-a-glance version of the same data. */
export function TierLadder({ milestoneTiers, currentTier, nextTier, registrationCount, accruedAmount }: TierLadderProps) {
  if (milestoneTiers.length === 0) return null;

  const ceiling = milestoneTiers.at(-1)?.maxRegistrations ?? milestoneTiers.at(-1)?.minRegistrations ?? 1;
  const trackPercent = Math.min(100, Math.round((registrationCount / Math.max(1, ceiling)) * 100));

  return (
    <Card className="border-border/50">
      <CardContent className="pt-6">
        <div className="flex items-baseline justify-between gap-2 mb-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Your progress</p>
            <h3 className="text-base font-bold text-foreground">Reward tier ladder</h3>
          </div>
          <p className="text-xl font-bold text-foreground tabular-nums">
            {registrationCount}
            <span className="text-xs font-medium text-muted-foreground ml-1">registrations</span>
          </p>
        </div>

        <div className="relative pt-1">
          <div className="absolute top-[22px] left-[22px] right-[22px] h-[3px] rounded-full bg-secondary" />
          <div
            className="absolute top-[22px] left-[22px] h-[3px] rounded-full bg-gradient-to-r from-chart-1 to-chart-2 transition-all duration-700"
            style={{ width: `calc(${trackPercent}% - 22px)`, maxWidth: 'calc(100% - 44px)' }}
          />
          <div className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${milestoneTiers.length}, minmax(0, 1fr))` }}>
            {milestoneTiers.map((tier, i) => {
              const isCurrent = currentTier?.minRegistrations === tier.minRegistrations;
              const isReached = registrationCount >= tier.minRegistrations;
              return (
                <div key={i} className="flex flex-col items-center text-center gap-2">
                  <div
                    className={
                      'flex h-11 w-11 items-center justify-center rounded-full border-[3px] bg-card font-bold text-sm transition-all ' +
                      (isCurrent
                        ? 'border-primary text-primary ring-[5px] ring-primary/15'
                        : isReached
                          ? 'border-chart-1 bg-chart-1 text-white'
                          : 'border-border text-muted-foreground')
                    }
                  >
                    {isCurrent ? (
                      registrationCount
                    ) : isReached ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>{tier.label ?? `Level ${i + 1}`}</p>
                    <p className="text-[10.5px] text-muted-foreground tabular-nums">
                      {tier.maxRegistrations ? `${tier.minRegistrations}–${tier.maxRegistrations}` : `${tier.minRegistrations}+`}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground tabular-nums">₹{tier.amountPerRegistration}/reg</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 flex-wrap pt-6 mt-6 border-t border-border/60">
          {nextTier ? (
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
          <div className="text-right ml-auto">
            <p className="text-2xl font-bold text-foreground tabular-nums">
              <Rupees amount={accruedAmount} />
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Accrued reward</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
