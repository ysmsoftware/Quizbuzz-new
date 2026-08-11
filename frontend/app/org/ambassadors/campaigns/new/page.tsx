'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrgAmbassadorCampaigns } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { CampaignForm, type CampaignFormValue } from '@/components/features/ambassador/CampaignForm';

export default function NewAmbassadorCampaignPage() {
  const router = useRouter();
  const { createCampaign, createCampaignLoading } = useOrgAmbassadorCampaigns();

  // Let errors propagate — CampaignForm owns validation + error display (inline
  // field highlights from ApiRequestError.details, not just a toast).
  const handleSubmit = async (value: CampaignFormValue) => {
    await createCampaign(value);
    toast.success('Campaign created');
    router.push('/org/ambassadors');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push('/org/ambassadors')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Ambassadors
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">New Ambassador Campaign</h1>
        <p className="text-sm text-muted-foreground">Configure milestone tiers, speed bonuses, and leaderboard prizes</p>
      </div>

      <CampaignForm onSubmit={handleSubmit} submitting={createCampaignLoading} submitLabel="Create Campaign" />
    </div>
  );
}
