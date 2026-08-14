'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CampaignsList } from '@/components/features/ambassador/CampaignsList';

export default function AmbassadorCampaignsPage() {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/org/ambassadors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Ambassadors
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
        <p className="text-sm text-muted-foreground">Manage referral campaigns and reward configuration</p>
      </div>

      <CampaignsList />
    </div>
  );
}
