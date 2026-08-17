'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Rupees } from './Rupees';
import type { CampaignStats } from '@/lib/types/ambassador';

function tierLabel(tier: CampaignStats['currentTier']) {
  if (!tier) return 'No tier yet';
  return tier.label ?? (tier.maxRegistrations ? `${tier.minRegistrations}-${tier.maxRegistrations} registrations` : `${tier.minRegistrations}+ registrations`);
}

/** The hub's headline card — tier progress and accrued reward together, with the next
 *  tier's rate named so sharing more has a concrete number attached, not just a bar. */
export function ProgressCard({ stats }: { stats: CampaignStats }) {
  const progress = stats.progressToNextTier;
  const percent = progress ? Math.min(100, Math.round((progress.current / progress.required) * 100)) : stats.currentTier ? 100 : 0;

  const remaining = progress ? progress.required - progress.current : null;

  return (
    <Card className="border-border/50">
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-base font-bold text-foreground">{tierLabel(stats.currentTier)}</span>
          <span className="text-sm text-muted-foreground">{stats.registrationCount} registrations</span>
        </div>
        <Progress value={percent} className="h-2" />
        <div className="flex items-end justify-between gap-3 flex-wrap pt-1">
          {progress && stats.nextTier ? (
            <p className="text-xs text-muted-foreground max-w-[60%]">
              {remaining} more registration{remaining === 1 ? '' : 's'} → {stats.nextTier.label ?? 'next tier'} (
              <Rupees amount={stats.nextTier.amountPerRegistration} />/registration)
            </p>
          ) : stats.currentTier && !stats.nextTier ? (
            <p className="text-xs text-muted-foreground max-w-[60%]">You&apos;ve reached the top tier</p>
          ) : null}
          <div className="text-right ml-auto">
            <p className="text-2xl font-bold text-foreground"><Rupees amount={stats.accruedAmount} /></p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Accrued reward</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
