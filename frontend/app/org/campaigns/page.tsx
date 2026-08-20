'use client';

import { CampaignsList } from '@/components/features/ambassador/CampaignsList';

export default function AmbassadorCampaignsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
        <p className="text-sm text-muted-foreground">Manage referral campaigns and reward configuration</p>
      </div>

      <CampaignsList />
    </div>
  );
}
