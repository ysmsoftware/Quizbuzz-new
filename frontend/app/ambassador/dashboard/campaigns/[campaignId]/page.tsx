'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAmbassadorCampaignStats } from '@/lib/hooks/useAmbassadorCampaignStats';
import { useAvailableCampaign, useJoinedCampaign, useMyCampaigns } from '@/lib/hooks/useAmbassadorCampaigns';
import { useAmbassadorMe } from '@/lib/hooks/useAmbassadorMe';
import { TierLadder } from '@/components/features/ambassador/TierLadder';
import { SpeedBonusStrip } from '@/components/features/ambassador/SpeedBonusStrip';
import { RankRewardCards } from '@/components/features/ambassador/RankRewardCards';
import { CampaignTimelineStrip } from '@/components/features/ambassador/CampaignTimelineStrip';
import { CampaignLeaderboardCard } from '@/components/features/ambassador/CampaignLeaderboardCard';
import { SocialProofStrip } from '@/components/features/ambassador/SocialProofStrip';
import { ShareCampaignCard } from '@/components/features/ambassador/ShareCampaignCard';
import { RewardTiersCard } from '@/components/features/ambassador/RewardTiersCard';
import { AmbassadorKitCard } from '@/components/features/ambassador/AmbassadorKitCard';
import { CampaignPreview } from '@/components/features/ambassador/CampaignPreview';
import { fillShareTemplate } from '@/lib/utils/share-template';
import { shareToWhatsApp } from '@/lib/utils/whatsapp-share';
import { leaderboardScopeKey } from '@/lib/types/ambassador';
import type { AvailableCampaignItem } from '@/lib/types/ambassador';

export default function AmbassadorCampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;

  // GET .../stats returns everything needed for the approved view in one call, but it's
  // gated to an APPROVED enrollment — so whether this ambassador has one at all (and its
  // status) has to come from the "mine" list first, before stats is even worth fetching.
  const { campaign: joinedCampaign, isLoading: joinedLoading } = useJoinedCampaign(campaignId);
  const isApproved = joinedCampaign?.status === 'APPROVED';

  const { stats, isLoading: statsLoading } = useAmbassadorCampaignStats(campaignId, { enabled: isApproved });
  // Not approved (or not applied at all): fall back to the same public-safe preview slice
  // the old Available-Campaigns drawer used, rendered through CampaignPreview instead.
  const { campaign: availableCampaign, isLoading: availableLoading } = useAvailableCampaign(campaignId);
  const { ambassador } = useAmbassadorMe();
  const { apply } = useMyCampaigns();

  const [linkCopied, setLinkCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [justApplied, setJustApplied] = useState(false);

  // The "available" list this preview's data comes from excludes anything already applied
  // to — so the moment Apply succeeds and that list refetches, this campaign drops out of
  // it. Freeze the first successful read instead of re-deriving it live, so the page doesn't
  // blank out from under someone who just applied.
  const [previewSnapshot, setPreviewSnapshot] = useState<AvailableCampaignItem | undefined>(undefined);
  useEffect(() => {
    if (availableCampaign && !previewSnapshot) setPreviewSnapshot(availableCampaign);
  }, [availableCampaign, previewSnapshot]);
  const preview = previewSnapshot ?? availableCampaign;

  // Every configured leaderboard cut renders as its own card, side by side on desktop — no
  // tab switcher.
  const ranks = useMemo(() => stats?.leaderboardRanks ?? [], [stats]);
  const ownRankByScope = useMemo(() => new Map(ranks.map((r) => [leaderboardScopeKey(r.scope), r.rank])), [ranks]);

  const loading = joinedLoading || (isApproved ? statsLoading : availableLoading && !previewSnapshot);

  const handleApply = async () => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!isApproved) {
    if (!preview) {
      return (
        <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 py-10 max-w-lg mx-auto text-center space-y-3">
          <p className="text-foreground font-semibold">This campaign preview isn&apos;t available.</p>
          <p className="text-sm text-muted-foreground">It may have closed, or no longer be open to your ambassador type.</p>
          <Button variant="outline" size="sm" onClick={() => router.push('/ambassador/dashboard/campaigns')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Campaigns
          </Button>
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
        applicationStatus={
          joinedCampaign?.status === 'PENDING' || joinedCampaign?.status === 'REJECTED' ? joinedCampaign.status : undefined
        }
        rejectionReason={joinedCampaign?.rejectionReason}
        onApply={handleApply}
        backHref="/ambassador/dashboard/campaigns"
        backLabel="Back to My Campaigns"
      />
    );
  }

  if (!stats) return null;

  const { campaign } = stats;
  const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = `${frontendUrl}/contests/${campaign.contestSlug}/register?ref=${campaign.referralCode}`;
  // {referralLink}/{ambassadorName}/{contestName} are the tokens an admin can drop into a
  // template (see ShareTemplatesEditor.tsx) — resolved here to this ambassador's real values
  // so every message on this page shows exactly what gets sent, not raw placeholder text.
  const shareValues = {
    referralLink,
    ambassadorName: ambassador?.firstName ?? 'Ambassador',
    contestName: joinedCampaign?.contestTitle ?? campaign.name,
  };
  const whatsappText = fillShareTemplate(campaign.shareTemplates.whatsappText || 'Join using my link: {referralLink}', shareValues);

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setLinkCopied(true);
    toast.success('Referral link copied');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const shareViaWhatsApp = async () => {
    setSharing(true);
    try {
      const result = await shareToWhatsApp({ text: whatsappText, posterImageUrl: campaign.shareTemplates.posterImageUrl, title: campaign.name });
      if (result === 'shared') toast.success('Shared — message and poster sent together');
      else if (result === 'clipboard') toast.success('Poster copied — paste it (⌘V / Ctrl+V) into the chat before sending', { duration: 5000 });
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push('/ambassador/dashboard/campaigns')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Campaigns
        </Button>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
              {campaign.status === 'LIVE' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-success bg-success/10 rounded-full px-2.5 py-1 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
              {(joinedCampaign?.organizationName || joinedCampaign?.contestTitle) && (
                <span>{[joinedCampaign?.organizationName, joinedCampaign?.contestTitle].filter(Boolean).join(' · ')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={copyReferralLink}>
              {linkCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {linkCopied ? 'Copied' : 'Copy referral link'}
            </Button>
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" disabled={sharing} onClick={shareViaWhatsApp}>
              <MessageCircle className="h-4 w-4" />
              {sharing ? 'Preparing…' : 'Share'}
            </Button>
          </div>
        </div>

        {/* Main content (progress/leaderboards/rewards/kit) on the left, sharing + rank in a
            sidebar on the right — a desktop dashboard layout, not a stretched mobile column. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_344px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <CampaignTimelineStrip status={campaign.status} endDate={campaign.endDate} phases={campaign.phases} />

            <TierLadder
              milestoneTiers={campaign.milestoneTiers}
              currentTier={stats.currentTier}
              nextTier={stats.nextTier}
              registrationCount={stats.registrationCount}
              accruedAmount={stats.accruedAmount}
            />

            <SpeedBonusStrip speedBonus={stats.speedBonus} />

            {campaign.status === 'LIVE' && <SocialProofStrip campaignId={campaignId} />}

            <section className="space-y-3">
              <div>
                <h2 className="text-[17px] font-bold text-foreground">Reward tiers</h2>
                <p className="text-xs text-muted-foreground mt-0.5">What each milestone pays out per registration.</p>
              </div>
              <RewardTiersCard milestoneTiers={campaign.milestoneTiers} currentTier={stats.currentTier} />
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-[17px] font-bold text-foreground">Leaderboards</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every cut of the standings, side by side — each stays its own leaderboard, just laid out as a grid.
                </p>
              </div>
              {campaign.leaderboardPrizes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {campaign.leaderboardPrizes.map((cut) => (
                    <CampaignLeaderboardCard
                      key={leaderboardScopeKey(cut.scope)}
                      campaignId={campaignId}
                      cut={cut}
                      ownRank={ownRankByScope.get(leaderboardScopeKey(cut.scope)) ?? null}
                      currentAmbassadorId={ambassador?.id}
                      // Milestone tiers pay individual ambassadors, not groups — the y-axis
                      // only shows tier thresholds on the individual-ambassador cut.
                      tierTicks={cut.scope.kind === 'INDIVIDUAL_AMBASSADOR' ? campaign.milestoneTiers : undefined}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">No leaderboard configured for this campaign.</p>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-[17px] font-bold text-foreground">Ambassador kit</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Ready-to-send messages with your referral link already filled in.</p>
              </div>
              <AmbassadorKitCard shareTemplates={campaign.shareTemplates} values={shareValues} campaignName={campaign.name} />
            </section>
          </div>

          <div className="space-y-4 lg:sticky lg:top-8">
            <RankRewardCards stats={stats} />

            <ShareCampaignCard
              campaignName={campaign.name}
              organizationName={joinedCampaign?.organizationName}
              contestTitle={joinedCampaign?.contestTitle}
              isLive={campaign.status === 'LIVE'}
              referralLink={referralLink}
              whatsappText={whatsappText}
              posterImageUrl={campaign.shareTemplates.posterImageUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
