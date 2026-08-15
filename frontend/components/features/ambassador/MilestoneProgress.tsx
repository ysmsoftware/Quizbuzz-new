'use client';

import { Progress } from '@/components/ui/progress';
import { Rupees } from './Rupees';
import type { CampaignStats } from '@/lib/types/ambassador';

function tierRange(tier: CampaignStats['currentTier']) {
  if (!tier) return null;
  return tier.maxRegistrations ? `${tier.minRegistrations}-${tier.maxRegistrations}` : `${tier.minRegistrations}+`;
}

function tierLabel(tier: CampaignStats['currentTier']) {
  if (!tier) return 'No tier yet';
  // Prefer the admin-set tier name ("Level 3"); fall back to the raw registration
  // range if this tier predates the label field.
  return tier.label ?? `${tierRange(tier)} registrations`;
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
        <p className="text-xs text-primary">
          Includes: {goodie.label}
          {goodie.cashEquivalent !== undefined && (
            <>
              {' '}(worth <Rupees amount={goodie.cashEquivalent} />)
            </>
          )}
        </p>
      )}
    </div>
  );
}
