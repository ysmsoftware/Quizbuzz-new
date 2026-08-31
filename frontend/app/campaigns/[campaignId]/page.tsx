'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublicCampaignPreview, useJoinedCampaign, useMyCampaigns } from '@/lib/hooks/useAmbassadorCampaigns';
import { useAmbassadorMe } from '@/lib/hooks/useAmbassadorMe';
import { CampaignPreview } from '@/components/features/ambassador/CampaignPreview';

/**
 * Public, no-login campaign page — a direct link (ads, socials, a QR code) that renders the
 * full reward/leaderboard picture before anyone has an account. Apply either applies straight
 * away (already logged in) or bounces through login/signup and back to the real dashboard
 * page, which is where an already-joined ambassador belongs instead of this generic preview.
 */
export default function PublicCampaignPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;

  const { campaign: preview, isLoading: previewLoading, isError: previewError } = usePublicCampaignPreview(campaignId);
  const { ambassador, isLoading: meLoading, isError: loggedOut } = useAmbassadorMe();
  const loggedIn = !meLoading && !loggedOut && !!ambassador;
  const { campaign: joinedCampaign, isLoading: joinedLoading } = useJoinedCampaign(campaignId);
  const { apply } = useMyCampaigns();

  const [applying, setApplying] = useState(false);
  const [justApplied, setJustApplied] = useState(false);

  // Already approved here — the full personalized dashboard page (referral link, real stats)
  // is strictly better than this generic preview, so hop straight there instead of showing both.
  useEffect(() => {
    if (loggedIn && joinedCampaign?.status === 'APPROVED') {
      router.replace(`/ambassador/dashboard/campaigns/${campaignId}`);
    }
  }, [loggedIn, joinedCampaign, campaignId, router]);

  const handleApply = async () => {
    if (!loggedIn) {
      router.push(`/ambassador/login?next=${encodeURIComponent(`/ambassador/dashboard/campaigns/${campaignId}`)}`);
      return;
    }
    setApplying(true);
    try {
      await apply(campaignId);
      setJustApplied(true);
      toast.success('Application submitted — the organizer will review it');
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  const loading = previewLoading || meLoading || (loggedIn && joinedLoading);

  if (loading || (loggedIn && joinedCampaign?.status === 'APPROVED')) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (previewError || !preview) {
    return (
      <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 py-10 max-w-lg mx-auto text-center space-y-3">
        <p className="text-foreground font-semibold">This campaign isn&apos;t available.</p>
        <p className="text-sm text-muted-foreground">It may have closed, or the link may be out of date.</p>
      </div>
    );
  }

  return (
    <CampaignPreview
      campaignId={campaignId}
      preview={preview}
      ambassadorId={ambassador?.id}
      hasApplied={justApplied || !!joinedCampaign}
      applying={applying}
      applicationStatus={joinedCampaign?.status === 'PENDING' || joinedCampaign?.status === 'REJECTED' ? joinedCampaign.status : undefined}
      rejectionReason={joinedCampaign?.rejectionReason}
      onApply={handleApply}
      backHref="/ambassador"
      backLabel="Back to Ambassador Program"
    />
  );
}
