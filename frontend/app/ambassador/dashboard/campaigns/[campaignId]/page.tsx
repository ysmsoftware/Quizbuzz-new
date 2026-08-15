'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAmbassadorCampaignStats, useAmbassadorCampaignLeaderboard } from '@/lib/hooks/useAmbassadorCampaignStats';
import { useJoinedCampaign } from '@/lib/hooks/useAmbassadorCampaigns';
import { useAmbassadorMe } from '@/lib/hooks/useAmbassadorMe';
import { CampaignStatsPanel } from '@/components/features/ambassador/CampaignStatsPanel';
import { LeaderboardTable } from '@/components/features/ambassador/LeaderboardTable';
import { ShareCampaignCard } from '@/components/features/ambassador/ShareCampaignCard';
import { leaderboardScopeKey } from '@/lib/types/ambassador';

export default function AmbassadorCampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.campaignId as string;

  // GET .../stats returns everything needed for this page in one call (campaign
  // name/contestSlug/referralCode/shareTemplates alongside the live numbers).
  // useJoinedCampaign (the cached "mine" list) is only used below as a non-blocking
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

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 max-w-2xl mx-auto space-y-4">
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
    <div className="min-h-screen bg-background px-4 py-6 sm:py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push('/ambassador/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Button>

        <div>
          <h1 className="text-xl font-bold text-foreground truncate">{campaign.name}</h1>
          {(joinedCampaign?.organizationName || joinedCampaign?.contestTitle) && (
            <p className="text-sm text-muted-foreground">
              {[joinedCampaign?.organizationName, joinedCampaign?.contestTitle].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        <CampaignStatsPanel stats={stats} />

        <ShareCampaignCard
          campaignName={campaign.name}
          referralLink={referralLink}
          whatsappText={whatsappText}
          posterImageUrl={campaign.shareTemplates.posterImageUrl}
        />

        {ranks.length > 0 && currentRank && currentScope && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Leaderboard</h2>
            <Tabs value={leaderboardScopeKey(currentRank.scope)} onValueChange={setActiveScopeKey}>
              <TabsList className="w-full flex-wrap h-auto">
                {ranks.map((r) => (
                  <TabsTrigger key={leaderboardScopeKey(r.scope)} value={leaderboardScopeKey(r.scope)} className="flex-1">
                    {r.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={leaderboardScopeKey(currentRank.scope)} className="mt-4">
                <LeaderboardTable
                  scope={currentScope}
                  label={currentRank.label}
                  rows={rows}
                  currentAmbassadorId={ambassador?.id}
                  isLoading={leaderboardLoading}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
