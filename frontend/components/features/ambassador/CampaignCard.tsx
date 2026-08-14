'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MilestoneProgress } from './MilestoneProgress';
import type { MyCampaignItem } from '@/lib/types/ambassador';

interface CampaignCardProps {
  campaign: MyCampaignItem;
  orgSlug: string;
}

export function CampaignCard({ campaign, orgSlug }: CampaignCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <MilestoneProgress stats={campaign.stats} />
        <Button asChild variant="outline" className="w-full">
          <Link href={`/ambassador/${orgSlug}/dashboard/campaigns/${campaign.campaignId}`}>
            View details
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
