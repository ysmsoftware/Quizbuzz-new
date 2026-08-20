'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { CAMPAIGN_STATUS_BADGE_VARIANT } from '@/components/features/ambassador/campaign-status';
import { CampaignManagePanel, type ManageTabKey } from '@/components/features/ambassador/admin/CampaignManagePanel';

/**
 * Campaign edit surface — the standalone-page fallback for direct links/bookmarks. The
 * primary way in is now the "Edit Campaign" drawer on the Overview page ([id]/page.tsx),
 * which renders this same CampaignManagePanel inline instead of navigating here.
 */
export default function CampaignManagePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [tab, setTab] = useState<ManageTabKey>('settings');

  const { campaign, isLoading } = useOrgAmbassadorCampaign(id);
  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');
  const typeLabel = (key: string) => types.find((t) => t.key === key)?.label ?? key;

  // A DRAFT campaign's home is the creation wizard, not this editor — redirect if someone
  // lands here directly (e.g. a stale bookmark from before it was published).
  useEffect(() => {
    if (campaign && campaign.status === 'DRAFT') {
      router.replace(`/org/campaigns/${id}/wizard`);
    }
  }, [campaign, id, router]);

  if (isLoading || !campaign || campaign.status === 'DRAFT') {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push(`/org/campaigns/${id}`)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Overview
      </Button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Edit {campaign.name}</h1>
            <Badge variant={CAMPAIGN_STATUS_BADGE_VARIANT[campaign.status]}>{campaign.status}</Badge>
            {campaign.ambassadorTypesAllowed.map((key) => (
              <Badge key={key} variant="outline" className="font-normal">
                {typeLabel(key)}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Manage rewards, leaderboards, and the ambassador kit.</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/org/campaigns/${id}/report`}>
            <BarChart3 className="h-4 w-4 mr-2" />
            View Report
          </Link>
        </Button>
      </div>

      <CampaignManagePanel campaign={campaign} activeTab={tab} onTabChange={setTab} />
    </div>
  );
}
