'use client';

import { useParams } from 'next/navigation';
import { CampaignWizard } from '@/components/features/ambassador/wizard/CampaignWizard';

/** Resumes an in-progress (DRAFT) campaign in the creation wizard. Once a campaign is
 *  PUBLISHED, campaigns/[id]/edit (the pre-existing single-page form) is used instead —
 *  the status-gated management dashboard replacing it is Phase 2. */
export default function ResumeAmbassadorCampaignWizardPage() {
  const params = useParams();
  const id = params.id as string;

  return <CampaignWizard campaignId={id} />;
}
