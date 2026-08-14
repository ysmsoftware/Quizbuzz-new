'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { CAMPAIGN_STATUS_BADGE_VARIANT } from '@/components/features/ambassador/campaign-status';
import { SettingsTab } from '@/components/features/ambassador/dashboard/SettingsTab';
import { StructureTab } from '@/components/features/ambassador/dashboard/StructureTab';
import { RewardsTab } from '@/components/features/ambassador/dashboard/RewardsTab';
import { LeaderboardsTab } from '@/components/features/ambassador/dashboard/LeaderboardsTab';
import { TimelineTab } from '@/components/features/ambassador/dashboard/TimelineTab';
import { KitTab } from '@/components/features/ambassador/dashboard/KitTab';

/**
 * Campaign edit surface — reached only via the explicit "Edit Campaign" button on the
 * read-only Overview ([id]/page.tsx). Each tab enforces the same status-gated field locks as
 * the backend (see campaign-field-locks.ts), so editing here never means "everything's always
 * editable" the way the old single-page CampaignForm did. The Overview is where an admin
 * checks on a campaign; this is only where they change it.
 */
export default function CampaignManagePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { campaign, isLoading } = useOrgAmbassadorCampaign(id);
  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');
  const typeLabel = (key: string) => types.find((t) => t.key === key)?.label ?? key;

  // A DRAFT campaign's home is the creation wizard, not this editor — redirect if someone
  // lands here directly (e.g. a stale bookmark from before it was published).
  useEffect(() => {
    if (campaign && campaign.status === 'DRAFT') {
      router.replace(`/org/ambassadors/campaigns/${id}/wizard`);
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
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push(`/org/ambassadors/campaigns/${id}`)}>
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
          <Link href={`/org/ambassadors/campaigns/${id}/report`}>
            <BarChart3 className="h-4 w-4 mr-2" />
            View Report
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="kit">Ambassador Kit</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab campaign={campaign} />
        </TabsContent>
        <TabsContent value="structure" className="mt-4">
          <StructureTab campaign={campaign} />
        </TabsContent>
        <TabsContent value="rewards" className="mt-4">
          <RewardsTab campaign={campaign} />
        </TabsContent>
        <TabsContent value="leaderboards" className="mt-4">
          <LeaderboardsTab campaign={campaign} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineTab campaign={campaign} />
        </TabsContent>
        <TabsContent value="kit" className="mt-4">
          <KitTab campaign={campaign} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
