'use client';

import { Check, Lock, Zap } from 'lucide-react';
import { Rupees } from './Rupees';
import { GoodieHoverCard } from './GoodieHoverCard';
import type { CampaignSpeedBonusStatus, MilestoneTier } from '@/lib/types/ambassador';

interface FacilitatorMilestonesProps {
  speedBonus: CampaignSpeedBonusStatus | null;
  milestoneTiers: MilestoneTier[];
  currentTier: MilestoneTier | null;
  registrationCount: number;
}

/** The campaign's full reward path as a row of status cards — one for the speed bonus,
 *  one per milestone tier (reached / current / locked) — instead of the current tier alone.
 *  Every number here is already returned by GET .../stats; no new data, just a different
 *  read of milestoneTiers + currentTier + registrationCount than the tier-progress bar uses. */
export function FacilitatorMilestones({ speedBonus, milestoneTiers, currentTier, registrationCount }: FacilitatorMilestonesProps) {
  if (!speedBonus && milestoneTiers.length === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {speedBonus && <SpeedBonusMilestoneCard speedBonus={speedBonus} />}
      {milestoneTiers.map((tier, i) => {
        const isDone = registrationCount >= tier.minRegistrations && (tier.maxRegistrations === null || registrationCount <= tier.maxRegistrations) && currentTier?.minRegistrations === tier.minRegistrations;
        const isReached = registrationCount >= tier.minRegistrations;
        const remaining = Math.max(0, tier.minRegistrations - registrationCount);
        const card = (
          <div
            className={`rounded-xl border p-4 ${isReached ? 'border-success/40 bg-success/5' : 'border-border/50 bg-card'} ${tier.goodie ? 'cursor-default' : ''}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isReached ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'}`}>
                {isReached ? <Check className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isReached ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground'}`}
              >
                {isReached ? (isDone ? 'Current' : 'Reached') : `${remaining} to go`}
              </span>
            </div>
            <p className="text-[13px] font-semibold text-foreground">{tier.label ?? `Tier ${i + 1}`}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
              {tier.goodie?.imageUrl && (
                <img src={tier.goodie.imageUrl} alt="" className="h-4 w-4 rounded object-cover border border-border/50" />
              )}
              <span>
                <Rupees amount={tier.amountPerRegistration} />
                /reg{tier.goodie ? ` · ${tier.goodie.label}` : ''}
              </span>
            </p>
          </div>
        );
        return (
          <div key={i}>
            {tier.goodie ? <GoodieHoverCard goodie={tier.goodie}>{card}</GoodieHoverCard> : card}
          </div>
        );
      })}
    </div>
  );
}

function SpeedBonusMilestoneCard({ speedBonus }: { speedBonus: CampaignSpeedBonusStatus }) {
  const earned = speedBonus.earned && speedBonus.tier;
  const goodie = earned ? speedBonus.tier!.goodie : undefined;
  const card = (
    <div className={`rounded-xl border p-4 ${earned ? 'border-warning/40 bg-warning/5' : 'border-border/50 bg-card'} ${goodie ? 'cursor-default' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${earned ? 'bg-warning text-warning-foreground' : 'bg-secondary text-muted-foreground'}`}>
          <Zap className="h-3.5 w-3.5" />
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${earned ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground'}`}>
          {earned ? 'Earned' : speedBonus.daysToMilestone !== null ? `${speedBonus.daysToMilestone.toFixed(1)}d left` : 'Not yet'}
        </span>
      </div>
      <p className="text-[13px] font-semibold text-foreground">{earned ? speedBonus.tier!.label : 'Speed bonus'}</p>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
        {goodie?.imageUrl && (
          <img src={goodie.imageUrl} alt="" className="h-4 w-4 rounded object-cover border border-border/50" />
        )}
        <span>
          {earned ? (
            <>
              <Rupees amount={speedBonus.tier!.bonusAmount} /> bonus{goodie ? ` · ${goodie.label}` : ''}
            </>
          ) : (
            'Hit the milestone fast for a bonus'
          )}
        </span>
      </p>
    </div>
  );
  return goodie ? <GoodieHoverCard goodie={goodie}>{card}</GoodieHoverCard> : card;
}
