'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { MyCampaignItem } from '@/lib/types/ambassador';

function tierLabel(tier: MyCampaignItem['stats']['currentTier']) {
  if (!tier) return 'No tier yet';
  return tier.label ?? (tier.maxRegistrations ? `${tier.minRegistrations}-${tier.maxRegistrations} regs` : `${tier.minRegistrations}+ regs`);
}

/** One row in "Campaigns at a glance" — name, status/tier subtitle, registration count,
 *  and a link into the detail page for anything already APPROVED. */
export function CampaignGlanceRow({ campaign }: { campaign: MyCampaignItem }) {
  const content = (
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 -mx-3 hover:bg-muted/60 transition-colors">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{campaign.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {campaign.organizationName} · {campaign.status === 'APPROVED' ? tierLabel(campaign.stats.currentTier) : campaign.status === 'PENDING' ? 'Pending review' : 'Not approved'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {campaign.stats.registrationCount} reg{campaign.stats.registrationCount === 1 ? '' : 's'}
        </span>
        {campaign.status === 'APPROVED' && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  );

  if (campaign.status !== 'APPROVED') return <div className="cursor-default">{content}</div>;

  return (
    <Link href={`/ambassador/dashboard/campaigns/${campaign.campaignId}`} className="block">
      {content}
    </Link>
  );
}
