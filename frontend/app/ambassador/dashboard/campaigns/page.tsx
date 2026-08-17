'use client';

import { useState } from 'react';
import { Megaphone, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useAvailableCampaigns, useMyCampaigns } from '@/lib/hooks/useAmbassadorCampaigns';
import { CampaignCard } from '@/components/features/ambassador/CampaignCard';
import { toast } from 'sonner';

/**
 * Cross-organization by design — mirrors the public /contests "browse all" page. An
 * ambassador is one platform identity; "My Campaigns" and "Available Campaigns" both span
 * every organization running a live campaign, not just one.
 */
export default function AmbassadorCampaignsPage() {
  const { campaigns: joinedCampaigns, isLoading: joinedLoading, apply } = useMyCampaigns();
  const { campaigns: availableCampaigns, isLoading: availableLoading, isError: availableError } = useAvailableCampaigns();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleApply = async (campaignId: string) => {
    setApplyingId(campaignId);
    try {
      await apply(campaignId);
      toast.success('Application submitted — the organizer will review it');
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-xl font-bold text-foreground">My Campaigns</h1>

        <section className="space-y-3">
          {joinedLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ) : joinedCampaigns.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Trophy className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>No applications yet</EmptyTitle>
              <EmptyDescription>Apply to an available campaign below to get started.</EmptyDescription>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {joinedCampaigns.map((campaign) => (
                <CampaignCard key={campaign.campaignId} campaign={campaign} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Available Campaigns</h2>
          {availableLoading ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : availableError || availableCampaigns.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Megaphone className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>No campaigns available</EmptyTitle>
              <EmptyDescription>Check back later for new campaigns to apply to.</EmptyDescription>
            </Empty>
          ) : (
            <div className="space-y-2">
              {availableCampaigns.map((campaign) => (
                <Card key={campaign.id} className="border-border/50">
                  <CardContent className="py-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{campaign.name}</p>
                      <Badge variant="secondary" className="font-normal text-xs mt-1">
                        {campaign.organizationName}
                      </Badge>
                    </div>
                    <Button size="sm" disabled={applyingId === campaign.id} onClick={() => handleApply(campaign.id)}>
                      {applyingId === campaign.id ? 'Applying…' : 'Apply'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
