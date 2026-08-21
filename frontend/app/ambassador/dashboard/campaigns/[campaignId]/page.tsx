'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAmbassadorCampaignStats } from '@/lib/hooks/useAmbassadorCampaignStats';
import { useJoinedCampaign } from '@/lib/hooks/useAmbassadorCampaigns';
import { useAmbassadorMe } from '@/lib/hooks/useAmbassadorMe';
import { usePlatformAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { TierLadder } from '@/components/features/ambassador/TierLadder';
import { SpeedBonusStrip } from '@/components/features/ambassador/SpeedBonusStrip';
import { RankRewardCards } from '@/components/features/ambassador/RankRewardCards';
import { CampaignTimelineStrip } from '@/components/features/ambassador/CampaignTimelineStrip';
import { CampaignLeaderboardCard } from '@/components/features/ambassador/CampaignLeaderboardCard';
import { SocialProofStrip } from '@/components/features/ambassador/SocialProofStrip';
import { ShareCampaignCard } from '@/components/features/ambassador/ShareCampaignCard';
import { RewardTiersCard } from '@/components/features/ambassador/RewardTiersCard';
import { AmbassadorKitCard } from '@/components/features/ambassador/AmbassadorKitCard';
import { fillShareTemplate } from '@/lib/utils/share-template';
import { shareToWhatsApp } from '@/lib/utils/whatsapp-share';
import { leaderboardScopeKey } from '@/lib/types/ambassador';

export default function AmbassadorCampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;

  // GET .../stats returns everything needed for this page in one call (campaign
  // name/contestSlug/referralCode/shareTemplates/status/timeline/tiers alongside the live
  // numbers). useJoinedCampaign (the cached "mine" list) is only used below as a non-blocking
  // enhancement for the org/contest subtitle, which the stats endpoint doesn't carry.
  const { stats, isLoading: statsLoading } = useAmbassadorCampaignStats(campaignId);
  const { campaign: joinedCampaign } = useJoinedCampaign(campaignId);
  const { ambassador } = useAmbassadorMe();
  const { types: platformTypes } = usePlatformAmbassadorTypes();
  const [linkCopied, setLinkCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Every configured leaderboard cut renders as its own card, side by side on desktop — no
  // tab switcher. Each CampaignLeaderboardCard fetches its own rows, so this stays a plain
  // list rather than a loop of hook calls.
  const ranks = useMemo(() => stats?.leaderboardRanks ?? [], [stats]);
  const ownRankByScope = useMemo(() => new Map(ranks.map((r) => [leaderboardScopeKey(r.scope), r.rank])), [ranks]);

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
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
  const typeLabel = (key: string) => platformTypes.find((t) => t.key === key)?.label ?? key;

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
              {campaign.ambassadorTypesAllowed.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/60">·</span>
                  open to
                  {campaign.ambassadorTypesAllowed.map((key) => (
                    <span key={key} className="text-[11px] font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                      {typeLabel(key)}
                    </span>
                  ))}
                </span>
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
                <h2 className="text-[17px] font-bold text-foreground">Leaderboards</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every cut of the standings, side by side — each stays its own leaderboard, just laid out as a grid.
                </p>
              </div>
              {ranks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ranks.map((r) => (
                    <CampaignLeaderboardCard
                      key={leaderboardScopeKey(r.scope)}
                      campaignId={campaignId}
                      scope={r.scope}
                      label={r.label}
                      ownRank={ownRankByScope.get(leaderboardScopeKey(r.scope)) ?? null}
                      currentAmbassadorId={ambassador?.id}
                      // Milestone tiers pay individual ambassadors, not groups — the y-axis
                      // only shows tier thresholds on the individual-ambassador cut.
                      tierTicks={r.scope.kind === 'INDIVIDUAL_AMBASSADOR' ? campaign.milestoneTiers : undefined}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">No leaderboard configured for this campaign.</p>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-[17px] font-bold text-foreground">Reward tiers</h2>
                <p className="text-xs text-muted-foreground mt-0.5">What each milestone pays out per registration.</p>
              </div>
              <RewardTiersCard milestoneTiers={campaign.milestoneTiers} currentTier={stats.currentTier} />
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
