'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAmbassadorCampaignStats, useAmbassadorCampaignLeaderboard } from '@/lib/hooks/useAmbassadorCampaignStats';
import { useJoinedCampaign } from '@/lib/hooks/useAmbassadorCampaigns';
import { useAmbassadorMe } from '@/lib/hooks/useAmbassadorMe';
import { ProgressCard } from '@/components/features/ambassador/ProgressCard';
import { SpeedBonusStrip } from '@/components/features/ambassador/SpeedBonusStrip';
import { RankRewardCards } from '@/components/features/ambassador/RankRewardCards';
import { CampaignTimelineStrip } from '@/components/features/ambassador/CampaignTimelineStrip';
import { LeaderboardPodium } from '@/components/features/ambassador/LeaderboardPodium';
import { LeaderboardTable } from '@/components/features/ambassador/LeaderboardTable';
import { ShareCampaignCard } from '@/components/features/ambassador/ShareCampaignCard';
import { RewardsKitTab } from '@/components/features/ambassador/RewardsKitTab';
import { leaderboardScopeKey } from '@/lib/types/ambassador';

export default function AmbassadorCampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = params.campaignId as string;
  const tab = searchParams.get('tab') === 'rewards' ? 'rewards' : 'leaderboard';

  // GET .../stats returns everything needed for this page in one call (campaign
  // name/contestSlug/referralCode/shareTemplates/status/timeline/tiers alongside the live
  // numbers). useJoinedCampaign (the cached "mine" list) is only used below as a non-blocking
  // enhancement for the org/contest subtitle, which the stats endpoint doesn't carry.
  const { stats, isLoading: statsLoading } = useAmbassadorCampaignStats(campaignId);
  const { campaign: joinedCampaign } = useJoinedCampaign(campaignId);
  const { ambassador } = useAmbassadorMe();

  const ranks = useMemo(() => stats?.leaderboardRanks ?? [], [stats]);
  const [activeScopeKey, setActiveScopeKey] = useState<string | null>(null);
  const currentRank = ranks.find((r) => leaderboardScopeKey(r.scope) === activeScopeKey) ?? ranks[0] ?? null;
  const currentScope = currentRank?.scope ?? null;

  const { rows, isLoading: leaderboardLoading } = useAmbassadorCampaignLeaderboard(
    campaignId,
    currentScope ?? { kind: 'INDIVIDUAL_AMBASSADOR' },
    { limit: 10 }
  );
  // rows arrive sorted by rank ascending (page 1) — the top 3 become the podium, the rest
  // stay in the plain table.
  const podiumRows = rows.slice(0, 3);
  const tableRows = rows.slice(3);

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
  const whatsappText = (campaign.shareTemplates.whatsappText || 'Join using my link: {referralLink}').replace(
    '{referralLink}',
    referralLink
  );

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push('/ambassador/dashboard/campaigns')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Campaigns
        </Button>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
            {(joinedCampaign?.organizationName || joinedCampaign?.contestTitle) && (
              <p className="text-sm text-muted-foreground">
                {[joinedCampaign?.organizationName, joinedCampaign?.contestTitle].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          {campaign.status === 'LIVE' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-success bg-success/10 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Live
            </span>
          )}
        </div>

        {/* Main content (progress/leaderboard/rewards) on the left, sharing + rank in a
            sidebar on the right — a desktop dashboard layout, not a stretched mobile column. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <CampaignTimelineStrip status={campaign.status} endDate={campaign.endDate} phases={campaign.phases} />

            <ProgressCard stats={stats} />

            <SpeedBonusStrip speedBonus={stats.speedBonus} />

            <Tabs value={tab} onValueChange={(v) => router.replace(`?tab=${v}`, { scroll: false })}>
              <TabsList>
                <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
                <TabsTrigger value="rewards">Rewards &amp; kit</TabsTrigger>
              </TabsList>

              <TabsContent value="leaderboard" className="mt-4 space-y-3">
                {ranks.length > 0 && currentRank && currentScope ? (
                  <Tabs value={leaderboardScopeKey(currentRank.scope)} onValueChange={setActiveScopeKey}>
                    <TabsList className="w-full flex-wrap h-auto">
                      {ranks.map((r) => (
                        <TabsTrigger key={leaderboardScopeKey(r.scope)} value={leaderboardScopeKey(r.scope)} className="flex-1">
                          {r.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <TabsContent value={leaderboardScopeKey(currentRank.scope)} className="mt-4">
                      {!leaderboardLoading && (
                        <LeaderboardPodium rows={podiumRows} scope={currentScope} currentAmbassadorId={ambassador?.id} />
                      )}
                      {(leaderboardLoading || tableRows.length > 0 || rows.length === 0) && (
                        <LeaderboardTable
                          scope={currentScope}
                          label={currentRank.label}
                          rows={tableRows}
                          currentAmbassadorId={ambassador?.id}
                          isLoading={leaderboardLoading}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                ) : (
                  <p className="text-sm text-muted-foreground py-6 text-center">No leaderboard configured for this campaign.</p>
                )}
              </TabsContent>

              <TabsContent value="rewards" className="mt-4">
                <RewardsKitTab
                  milestoneTiers={campaign.milestoneTiers}
                  currentTier={stats.currentTier}
                  shareTemplates={campaign.shareTemplates}
                  referralLink={referralLink}
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6 lg:sticky lg:top-8">
            <ShareCampaignCard
              campaignName={campaign.name}
              referralLink={referralLink}
              whatsappText={whatsappText}
              posterImageUrl={campaign.shareTemplates.posterImageUrl}
            />

            <RankRewardCards stats={stats} />
          </div>
        </div>
      </div>
    </div>
  );
}
