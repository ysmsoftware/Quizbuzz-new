'use client';

import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Rupees } from './Rupees';
import { GoodieHoverCard } from './GoodieHoverCard';
import { onImageError } from '@/lib/utils/image';
import type { CampaignStats } from '@/lib/types/ambassador';
import { tierRangePhrase } from '@/lib/utils/milestone-tiers';

function tierLabel(tier: CampaignStats['currentTier']) {
  if (!tier) return 'No tier yet';
  // Prefer the admin-set tier name ("Level 3"); fall back to the raw registration
  // range if this tier predates the label field.
  return tier.label ?? tierRangePhrase(tier);
}

export function MilestoneProgress({ stats }: { stats: CampaignStats }) {
  const progress = stats.progressToNextTier;
  const percent = progress ? Math.min(100, Math.round((progress.current / progress.required) * 100)) : stats.currentTier ? 100 : 0;
  const goodie = stats.currentTier?.goodie;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{tierLabel(stats.currentTier)}</span>
        <span className="text-muted-foreground">{stats.registrationCount} registrations</span>
      </div>
      <Progress value={percent} className="h-2" />
      {progress && (
        <p className="text-xs text-muted-foreground">{progress.required - progress.current} more to reach the next tier</p>
      )}
      {goodie && (
        <GoodieHoverCard goodie={goodie}>
          <p className="flex items-center gap-1.5 text-xs text-primary cursor-default">
            {goodie.imageUrl && (
              <span className="relative inline-block h-5 w-5 shrink-0">
                <Image src={goodie.imageUrl} alt="" fill sizes="20px" onError={onImageError} className="rounded object-cover border border-border/50" />
              </span>
            )}
            <span>
              Includes: {goodie.label}
              {goodie.cashEquivalent !== undefined && (
                <>
                  {' '}(worth <Rupees amount={goodie.cashEquivalent} />)
                </>
              )}
            </span>
          </p>
        </GoodieHoverCard>
      )}
    </div>
  );
}
