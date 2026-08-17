import { redirect } from 'next/navigation';

// Campaign detail is now reached via the cross-organization dashboard, not an org-scoped
// path — see /ambassador/dashboard/campaigns/[campaignId].
export default async function LegacyOrgAmbassadorCampaignDetailRedirect({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  redirect(`/ambassador/dashboard/campaigns/${campaignId}`);
}
