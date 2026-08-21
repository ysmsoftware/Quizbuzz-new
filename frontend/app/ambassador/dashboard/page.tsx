'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Megaphone, Trophy, Zap } from 'lucide-react';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useAmbassadorMe } from '@/lib/hooks/useAmbassadorMe';
import { useMyCampaigns } from '@/lib/hooks/useAmbassadorCampaigns';
import { useAmbassadorCampaignStats } from '@/lib/hooks/useAmbassadorCampaignStats';
import { useAmbassadorActivity } from '@/lib/hooks/useAmbassadorActivity';
import { IdentityHero } from '@/components/features/ambassador/IdentityHero';
import { EarningsOverviewCard } from '@/components/features/ambassador/EarningsOverviewCard';
import { StatTile } from '@/components/features/ambassador/StatTile';
import { ActiveCampaignCard } from '@/components/features/ambassador/ActiveCampaignCard';
import { SocialProofStrip } from '@/components/features/ambassador/SocialProofStrip';
import { FacilitatorMilestones } from '@/components/features/ambassador/FacilitatorMilestones';
import { RankRewardCards } from '@/components/features/ambassador/RankRewardCards';
import { CampaignGlanceRow } from '@/components/features/ambassador/CampaignGlanceRow';
import { Rupees } from '@/components/features/ambassador/Rupees';

/**
 * Overview — identity, aggregate earnings, the hero active-campaign card, and a glance list
 * of everything else. The full campaign list (joined + available to apply) lives at
 * /ambassador/dashboard/campaigns.
 */
export default function AmbassadorDashboardPage() {
  const { ambassador } = useAmbassadorMe();
  if (!ambassador) return null;
  return <LoadedDashboard ambassador={ambassador} />;
}

function LoadedDashboard({ ambassador }: { ambassador: NonNullable<ReturnType<typeof useAmbassadorMe>['ambassador']> }) {
  const { campaigns: joinedCampaigns, isLoading: joinedLoading } = useMyCampaigns();
  const { dailyRegistrations, trendPercent, isLoading: activityLoading } = useAmbassadorActivity();

  const approvedCampaigns = useMemo(() => joinedCampaigns.filter((c) => c.status === 'APPROVED'), [joinedCampaigns]);

  // The most-active approved campaign leads the page; everything else (including
  // pending/rejected applications) is in the full list at /dashboard/campaigns.
  const heroCampaign = useMemo(
    () => [...approvedCampaigns].sort((a, b) => b.stats.registrationCount - a.stats.registrationCount)[0] ?? null,
    [approvedCampaigns]
  );

  // MyCampaignItem doesn't carry timeline (phases/endDate/status), milestoneTiers, or a
  // populated leaderboard rank — only GET .../stats does — so the hero card's richer detail
  // (and the milestones grid + social proof strip below it) is fetched separately.
  const { stats: heroDetail } = useAmbassadorCampaignStats(heroCampaign?.campaignId ?? '');

  const liveCount = useMemo(
    () => approvedCampaigns.filter((c) => c.campaignStatus === 'LIVE').length,
    [approvedCampaigns]
  );

  const totals = useMemo(
    () => ({
      campaigns: joinedCampaigns.length,
      registrations: approvedCampaigns.reduce((sum, c) => sum + c.stats.registrationCount, 0),
      earned: approvedCampaigns.reduce((sum, c) => sum + c.stats.accruedAmount, 0),
      speedBonusEarned: approvedCampaigns.reduce(
        (sum, c) => sum + (c.stats.speedBonus?.earned ? (c.stats.speedBonus.tier?.bonusAmount ?? 0) : 0),
        0
      ),
    }),
    [joinedCampaigns, approvedCampaigns]
  );

  const bestRank = useMemo(() => {
    const ranked = (heroDetail?.leaderboardRanks ?? []).filter((r) => r.rank !== null) as { rank: number }[];
    if (ranked.length === 0) return null;
    const best = ranked.reduce((min, r) => (r.rank < min.rank ? r : min));
    // "of N" isn't returned by /stats (only the leaderboard endpoint's pagination carries a
    // total) — approximated here as ambassadorCount for the hero campaign once loaded, since
    // that's the same population a leaderboard ranks over.
    return { rank: best.rank, of: heroDetail?.campaign ? approvedCampaigns.length : best.rank };
  }, [heroDetail, approvedCampaigns.length]);

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto">
        {joinedLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton className="h-24 w-full rounded-xl sm:col-span-2" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <IdentityHero
              ambassador={ambassador}
              activeCampaigns={liveCount}
              totalRegistrations={totals.registrations}
              bestRank={bestRank}
            />
          </motion.div>
        )}

        {!joinedLoading && joinedCampaigns.length > 0 && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4 mb-6"
          >
            <EarningsOverviewCard
              totalEarned={totals.earned}
              campaignCount={approvedCampaigns.length}
              dailyRegistrations={dailyRegistrations}
              trendPercent={trendPercent}
              isLoading={activityLoading}
            />
            <div className="grid grid-cols-1 gap-4">
              <StatTile icon={Megaphone} tone="primary" value={totals.campaigns} label="Campaigns" sub={liveCount > 0 ? `${liveCount} live` : 'Across every organization'} />
              <StatTile
                icon={Zap}
                tone="accent"
                value={<Rupees amount={totals.speedBonusEarned} />}
                label="Speed bonus earned"
                sub="Across every campaign"
              />
            </div>
          </motion.div>
        )}

        <section className="space-y-3 mb-6">
          {joinedLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : joinedCampaigns.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Trophy className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>No applications yet</EmptyTitle>
              <EmptyDescription>Apply to an available campaign below to get started.</EmptyDescription>
            </Empty>
          ) : heroCampaign ? (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active campaign</h2>
              <ActiveCampaignCard campaign={heroCampaign} detail={heroDetail} />
              {heroCampaign.campaignStatus === 'LIVE' && <SocialProofStrip campaignId={heroCampaign.campaignId} />}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Your application is awaiting review — you&rsquo;ll see it here once approved.</p>
          )}
        </section>

        {heroDetail && (
          <section className="space-y-3 mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Facilitator milestones</h2>
            <FacilitatorMilestones
              speedBonus={heroDetail.speedBonus}
              milestoneTiers={heroDetail.campaign.milestoneTiers}
              currentTier={heroDetail.currentTier}
              registrationCount={heroDetail.registrationCount}
            />
          </section>
        )}

        {!joinedLoading && joinedCampaigns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.16 }}
            className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mb-6"
          >
            <div className="rounded-xl border border-border/50 bg-card shadow-sm p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Campaigns at a glance</p>
              <div className="space-y-1">
                {joinedCampaigns.map((campaign) => (
                  <CampaignGlanceRow key={campaign.campaignId} campaign={campaign} />
                ))}
              </div>
            </div>
            {heroCampaign && (
              <div>{heroDetail ? <RankRewardCards stats={heroDetail} /> : <Skeleton className="h-40 w-full rounded-xl" />}</div>
            )}
          </motion.div>
        )}

        <Link
          href="/ambassador/dashboard/campaigns"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          View all campaigns
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
