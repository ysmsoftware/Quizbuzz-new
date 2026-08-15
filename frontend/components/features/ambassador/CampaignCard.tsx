'use client';

import Link from 'next/link';
import { ArrowRight, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MilestoneProgress } from './MilestoneProgress';
import type { MyCampaignItem } from '@/lib/types/ambassador';

interface CampaignCardProps {
  campaign: MyCampaignItem;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
            <p className="text-xs text-muted-foreground truncate">{campaign.organizationName}</p>
          </div>
          {campaign.status !== 'APPROVED' && <StatusBadge status={campaign.status} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {campaign.status === 'APPROVED' ? (
          <>
            <MilestoneProgress stats={campaign.stats} />
            <Button asChild variant="outline" className="w-full">
              <Link href={`/ambassador/dashboard/campaigns/${campaign.campaignId}`}>
                View details
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </>
        ) : campaign.status === 'REJECTED' ? (
          <p className="text-sm text-muted-foreground">
            {campaign.rejectionReason || 'This application was not approved.'}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your application is with {campaign.organizationName} for review. You&apos;ll get your referral link once approved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: MyCampaignItem['status'] }) {
  if (status === 'REJECTED') {
    return (
      <Badge variant="outline" className="gap-1 text-destructive border-destructive/30 shrink-0">
        <XCircle className="h-3 w-3" />
        Not approved
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground shrink-0">
      <Clock className="h-3 w-3" />
      Pending review
    </Badge>
  );
}
