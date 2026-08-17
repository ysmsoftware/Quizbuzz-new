'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Rupees } from './Rupees';
import type { MyCampaignItem } from '@/lib/types/ambassador';

function tierLabel(tier: MyCampaignItem['stats']['currentTier']) {
  if (!tier) return 'No tier yet';
  return tier.label ?? (tier.maxRegistrations ? `${tier.minRegistrations}-${tier.maxRegistrations} registrations` : `${tier.minRegistrations}+ registrations`);
}

/** The "My Campaigns" hero — the approved campaign with the most registrations, promoted
 *  above the rest so the ambassador's most active campaign leads instead of being just
 *  another card in the grid. */
export function ActiveCampaignCard({ campaign }: { campaign: MyCampaignItem }) {
  const { stats } = campaign;
  const progress = stats.progressToNextTier;
  const percent = progress ? Math.min(100, Math.round((progress.current / progress.required) * 100)) : stats.currentTier ? 100 : 0;

  return (
    <Card className="border-border/50">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-foreground">{campaign.name}</h3>
            <p className="text-xs text-muted-foreground">{campaign.organizationName} · {campaign.contestTitle}</p>
          </div>
          {campaign.campaignStatus === 'LIVE' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-success bg-success/10 rounded-full px-2.5 py-1 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Live
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-4 items-center">
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium text-foreground">{tierLabel(stats.currentTier)}</span>
              <span className="text-muted-foreground">{stats.registrationCount} regs</span>
            </div>
            <Progress value={percent} className="h-2" />
            {progress && (
              <p className="text-xs text-muted-foreground mt-1.5">{progress.required - progress.current} more to the next tier</p>
            )}
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{stats.registrationCount}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Registrations</p>
          </div>
          <div>
            <p className="text-xl font-bold text-foreground"><Rupees amount={stats.accruedAmount} /></p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Earned</p>
          </div>
        </div>

        <Link
          href={`/ambassador/dashboard/campaigns/${campaign.campaignId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          Open campaign
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
