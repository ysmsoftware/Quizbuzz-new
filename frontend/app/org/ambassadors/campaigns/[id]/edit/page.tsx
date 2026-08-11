'use client';

import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { CampaignForm, type CampaignFormValue } from '@/components/features/ambassador/CampaignForm';

export default function EditAmbassadorCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { campaign, isLoading, updateCampaign, updateCampaignLoading } = useOrgAmbassadorCampaign(id);

  // Let errors propagate — CampaignForm owns validation + error display (inline
  // field highlights from ApiRequestError.details, not just a toast).
  const handleSubmit = async (value: CampaignFormValue) => {
    await updateCampaign({
      name: value.name,
      ambassadorTypesAllowed: value.ambassadorTypesAllowed,
      rewardConfig: value.rewardConfig,
      shareTemplates: value.shareTemplates,
    });
    toast.success('Campaign updated');
    router.push('/org/ambassadors');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push('/org/ambassadors')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Ambassadors
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Campaign</h1>
      </div>

      {isLoading || !campaign ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <CampaignForm initial={campaign} onSubmit={handleSubmit} submitting={updateCampaignLoading} submitLabel="Save Changes" />
      )}
    </div>
  );
}
