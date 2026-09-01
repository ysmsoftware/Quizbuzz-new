'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, BarChart3, BookmarkPlus, MoreVertical, Pencil, Users, Wallet, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { listContests } from '@/lib/api/contests.api';
import { useOrgAmbassadorCampaign, useOrgAmbassadorCampaignGroups } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { useOrgAmbassadorReport } from '@/lib/hooks/useOrgAmbassadorReport';
import { ambassadorCampaignApi } from '@/lib/api/ambassador-campaign.api';
import { CAMPAIGN_STATUS_BADGE_VARIANT } from '@/components/features/ambassador/campaign-status';
import { calculateCampaignCapacity } from '@/components/features/ambassador/campaign-capacity';
import { CampaignManagePanel, type ManageTabKey } from '@/components/features/ambassador/admin/CampaignManagePanel';
import { SaveAsTemplateModal } from '@/components/features/ambassador/SaveAsTemplateModal';
import { leaderboardScopeKey } from '@/lib/types/ambassador';
import { Rupees } from '@/components/features/ambassador/Rupees';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import {
  CARD,
  StatCard,
  DesktopPhaseTracker,
  MobilePhaseTracker,
  TopAmbassadorsCard,
  MilestoneReachCard,
  LeaderboardsCard,
  AmbassadorKitCard,
  RecentlyJoinedCard,
  RewardBudgetCard,
  AmbassadorStructureCard,
  RecordCard,
  formatDate,
} from './overview-cards';

// Campaign-wide totals/tier-counts/recently-joined come from the dedicated stats endpoint
// (computed over every approved enrollment) — never summed client-side over a report page,
// which would silently undercount past that endpoint's page-size cap. The report endpoint
// itself is only used here for the ranked Top Ambassadors table, so it only needs top-N rows.
const TOP_AMBASSADOR_COUNT = 5;

/** Mirrors the loaded page's actual shape (header, timeline, 4 stat cards, two-column card
 *  stack) so nothing visibly jumps around once real data replaces it. */
function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-36" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <Card className={cn(CARD, 'gap-2')}>
        <CardHeader>
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-1 w-full rounded-full" />
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className={CARD}>
            <CardContent className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[13fr_7fr] gap-3 items-start">
        <div className="space-y-3 min-w-0">
          <Card className={CARD}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
          <Card className={CARD}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-3 min-w-0">
          {[0, 1, 2].map((i) => (
            <Card key={i} className={CARD}>
              <CardHeader>
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Campaign Overview — the default landing page for a specific campaign, read-only by design.
 * Shows what's actually happening (status, current phase, ambassador/registration counts,
 * top performers, reward budget, kit assets) without exposing any editable fields; "Edit
 * Campaign" is the one deliberate way to reach the tabbed editor at [id]/manage.
 *
 * Renders two layout trees off the same data: the original desktop two-column dashboard
 * (`hidden lg:block`) and a tabbed mobile layout (`lg:hidden`, Overview / Ambassadors /
 * Rewards & Kit) that reorganizes the same cards to avoid one extremely long single-column
 * scroll on a phone. Both trees mount at once (CSS toggles which is visible) rather than
 * switching via a JS media-query check, so there's no hydration/breakpoint-detection flicker.
 */
export default function CampaignOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { campaign, isLoading, isError, refetch } = useOrgAmbassadorCampaign(id);
  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');
  const typeLabel = (key: string) => types.find((t) => t.key === key)?.label ?? key;

  // "Edit Campaign" and the Leaderboards/Kit cards' quick-edit links all open the same tabbed
  // editor in a drawer instead of navigating to the standalone /manage page — same panel,
  // opened to whichever tab is relevant.
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<ManageTabKey>('settings');
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const openManage = (tab: ManageTabKey) => {
    setManageTab(tab);
    setManageOpen(true);
  };

  const { data: contestsRes } = useQuery({
    queryKey: ['contests', 'list', { limit: 100 }],
    queryFn: () => listContests({ limit: 100 }),
    enabled: !!activeOrg?.id,
  });
  const contest = contestsRes?.data?.data?.find((c) => c.id === campaign?.contestId);

  const { groups, capacity: rawCapacity } = useOrgAmbassadorCampaignGroups(id);
  const capacity = rawCapacity ?? calculateCampaignCapacity(groups);

  const { data: statsRes } = useQuery({
    queryKey: ['org-ambassador-campaign-stats', id],
    queryFn: () => ambassadorCampaignApi.getCampaignStats(id),
    enabled: !!id,
  });
  const stats = statsRes?.data;
  const ambassadorCount = stats?.ambassadorCount ?? 0;
  const totalRegistrations = stats?.totalRegistrations ?? 0;
  const totalAccrued = stats?.totalAccruedAmount ?? 0;
  const avgRegistrationsPerAmbassador = ambassadorCount > 0 ? totalRegistrations / ambassadorCount : 0;
  const recentlyJoined = stats?.recentlyJoined ?? [];

  // Top Ambassadors only ever needs the first page, ranked server-side — campaign-wide totals
  // above come from the stats aggregate instead, not from summing this (possibly partial) list.
  const { rows: topAmbassadors } = useOrgAmbassadorReport(id, { limit: TOP_AMBASSADOR_COUNT, sortBy: 'registrationCount', sortOrder: 'desc' });

  const rewardConfig = campaign?.rewardConfig;
  const milestoneTiers = rewardConfig?.milestoneTiers ?? [];
  // stats.tierCounts is already ordered the same as milestoneTiers, plus a trailing "No Tier"
  // bucket — zip by position for the range text (min/maxRegistrations), the same thresholds
  // set when the campaign was created, so it's clear why an ambassador landed in a given tier.
  const tierDistribution = useMemo(() => {
    const tierCounts = stats?.tierCounts ?? [];
    const maxCount = Math.max(...tierCounts.map((t) => t.count), 1);
    return tierCounts.map((t, i) => {
      const tier = milestoneTiers[i];
      const range = tier ? (tier.maxRegistrations != null ? `${tier.minRegistrations}–${tier.maxRegistrations} regs` : `${tier.minRegistrations}+ regs`) : undefined;
      return { label: t.label, count: t.count, range, percent: Math.round((t.count / maxCount) * 100) };
    });
  }, [stats, milestoneTiers]);

  const leaderboardCuts = rewardConfig?.leaderboardPrizes ?? [];
  const [activeCutIndex, setActiveCutIndex] = useState(0);
  const activeCut = leaderboardCuts[activeCutIndex] ?? leaderboardCuts[0];
  const { data: previewLeaderboardRes } = useQuery({
    queryKey: ['org-ambassador-leaderboard-preview', id, activeCut ? leaderboardScopeKey(activeCut.scope) : null],
    queryFn: () => ambassadorCampaignApi.getLeaderboard(id, activeCut!.scope, { limit: 3 }),
    enabled: !!activeCut,
  });
  const previewLeaderboardRows = previewLeaderboardRes?.data?.data ?? [];

  // A DRAFT campaign's home is the creation wizard, not this overview — redirect if someone
  // lands here directly (e.g. a stale bookmark from before it was published).
  useEffect(() => {
    if (campaign && campaign.status === 'DRAFT') {
      router.replace(`/org/campaigns/${id}/wizard`);
    }
  }, [campaign, id, router]);

  if (isLoading || (campaign && campaign.status === 'DRAFT')) {
    return <PageSkeleton />;
  }

  if (isError || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="p-6 bg-destructive/10 rounded-full">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Couldn&apos;t load this campaign</h2>
          <p className="text-muted-foreground">It may not exist, or something went wrong fetching it.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => refetch()} variant="outline">Retry</Button>
          <Button asChild>
            <Link href="/org/campaigns">Back to Campaigns</Link>
          </Button>
        </div>
      </div>
    );
  }

  const speedBonusOn = !!rewardConfig?.speedBonus?.enabled;
  const speedBonusBudget = speedBonusOn
    ? (rewardConfig?.speedBonus?.tiers ?? []).reduce((acc, t) => acc + (t.maxWinners ? t.maxWinners * t.bonusAmount : t.bonusAmount), 0)
    : 0;
  const leaderboardBudget = leaderboardCuts.reduce((accCut, cut) => {
    const rankSum = (cut.ranks ?? []).reduce((accRank, r) => accRank + (r.cashAmount ?? 0) + (r.goodie?.cashEquivalent ?? 0), 0);
    return accCut + rankSum + (cut.consolation?.cashAmount ?? 0);
  }, 0);
  const totalBudget = speedBonusBudget + leaderboardBudget;

  const shareTemplates = campaign.shareTemplates;
  const whatsappTemplates = shareTemplates.whatsappTemplates ?? (shareTemplates.whatsappText ? [{ id: 'legacy', label: 'Default', text: shareTemplates.whatsappText, includePoster: true }] : []);
  const primaryTemplate = whatsappTemplates[0];
  const reportHref = `/org/campaigns/${id}/report`;

  return (
    <div className="space-y-4">

      {/* ============================= MOBILE (< lg) ============================= */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 -mt-4 sm:-mt-6 pt-4 sm:pt-6 pb-3 bg-background/95 backdrop-blur-sm border-b border-border/50 space-y-3">
          <div className="flex items-start gap-2">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => router.push('/org/campaigns')} aria-label="Back to campaigns">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-lg font-bold text-foreground truncate">{campaign.name}</h1>
                <Badge variant={CAMPAIGN_STATUS_BADGE_VARIANT[campaign.status]} className="shrink-0">{campaign.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Promoting <span className="font-medium text-foreground">{contest?.title ?? '—'}</span>
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" aria-label="More options">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={reportHref}>
                    <BarChart3 className="h-4 w-4 mr-2" /> Full Report
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSaveTemplateOpen(true)}>
                  <BookmarkPlus className="h-4 w-4 mr-2" /> Save as Template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openManage('settings')}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit Campaign
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {(campaign.ambassadorTypesAllowed.length > 0 || campaign.startDate) && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {campaign.ambassadorTypesAllowed.map((key) => (
                <Badge key={key} variant="outline" className="font-normal shrink-0 whitespace-nowrap">{typeLabel(key)}</Badge>
              ))}
              {campaign.startDate && <Badge variant="outline" className="font-normal shrink-0 whitespace-nowrap">Started {formatDate(campaign.startDate)}</Badge>}
            </div>
          )}
        </div>

        <Tabs defaultValue="overview" className="mt-4 gap-3">
          <TabsList className="w-full grid grid-cols-3 h-auto">
            <TabsTrigger value="overview" className="py-2.5">Overview</TabsTrigger>
            <TabsTrigger value="ambassadors" className="py-2.5">Ambassadors</TabsTrigger>
            <TabsTrigger value="rewards" className="py-2.5">Rewards &amp; Kit</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 mt-0">
            <WidgetErrorBoundary name="Campaign Stats">
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Users}
                  label="Ambassadors"
                  value={ambassadorCount.toLocaleString()}
                  context={capacity.totalAmbassadorTarget ? `of ${capacity.totalAmbassadorTarget.toLocaleString()} target` : undefined}
                  progressPercent={capacity.totalAmbassadorTarget ? Math.min(100, (ambassadorCount / capacity.totalAmbassadorTarget) * 100) : undefined}
                />
                <StatCard
                  icon={BarChart3}
                  label="Registrations"
                  value={totalRegistrations.toLocaleString()}
                  context={
                    capacity.totalRegistrationTarget
                      ? `${Math.round((totalRegistrations / capacity.totalRegistrationTarget) * 100)}% of ${capacity.totalRegistrationTarget.toLocaleString()}`
                      : undefined
                  }
                  progressPercent={capacity.totalRegistrationTarget ? Math.min(100, (totalRegistrations / capacity.totalRegistrationTarget) * 100) : undefined}
                />
                <StatCard icon={Wallet} label="Accrued Payout" value={<Rupees amount={totalAccrued} />} context="Across all ambassadors" />
                <StatCard icon={TrendingUp} label="Avg / Ambassador" value={avgRegistrationsPerAmbassador.toFixed(1)} context="Regs per ambassador" />
              </div>
            </WidgetErrorBoundary>

            <WidgetErrorBoundary name="Timeline & Phase">
              <Card className={CARD}>
                <CardContent>
                  <MobilePhaseTracker phases={campaign.phases ?? []} />
                </CardContent>
              </Card>
            </WidgetErrorBoundary>

            <WidgetErrorBoundary name="Recently Joined">
              <RecentlyJoinedCard rows={recentlyJoined} />
            </WidgetErrorBoundary>

            {milestoneTiers.length > 0 && (
              <WidgetErrorBoundary name="Milestone Reach">
                <MilestoneReachCard ambassadorCount={ambassadorCount} tierDistribution={tierDistribution} />
              </WidgetErrorBoundary>
            )}
          </TabsContent>

          <TabsContent value="ambassadors" className="space-y-3 mt-0">
            <WidgetErrorBoundary name="Top Ambassadors">
              <TopAmbassadorsCard rows={topAmbassadors} reportHref={reportHref} variant="list" />
            </WidgetErrorBoundary>

            {leaderboardCuts.length > 0 && (
              <WidgetErrorBoundary name="Leaderboards">
                <LeaderboardsCard
                  cuts={leaderboardCuts}
                  activeCutIndex={activeCutIndex}
                  onSelectCut={setActiveCutIndex}
                  previewRows={previewLeaderboardRows}
                  onManage={() => openManage('leaderboards')}
                />
              </WidgetErrorBoundary>
            )}
          </TabsContent>

          <TabsContent value="rewards" className="space-y-3 mt-0">
            <WidgetErrorBoundary name="Reward Budget">
              <RewardBudgetCard leaderboardBudget={leaderboardBudget} speedBonusBudget={speedBonusBudget} totalBudget={totalBudget} />
            </WidgetErrorBoundary>
            <WidgetErrorBoundary name="Ambassador Kit">
              <AmbassadorKitCard
                shareTemplates={shareTemplates}
                whatsappTemplates={whatsappTemplates}
                primaryTemplate={primaryTemplate}
                contestTitle={contest?.title}
                onEdit={() => openManage('kit')}
              />
            </WidgetErrorBoundary>
            <WidgetErrorBoundary name="Ambassador Structure">
              <AmbassadorStructureCard capacity={capacity} ambassadorCount={ambassadorCount} />
            </WidgetErrorBoundary>
            <WidgetErrorBoundary name="Record">
              <RecordCard campaignId={id} status={campaign.status} publishedAt={campaign.publishedAt} updatedAt={campaign.updatedAt} />
            </WidgetErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>

      {/* ============================= DESKTOP (>= lg) ============================= */}
      <div className="hidden lg:block space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push('/org/campaigns')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Campaigns
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
              <Badge variant={CAMPAIGN_STATUS_BADGE_VARIANT[campaign.status]}>{campaign.status}</Badge>
              {campaign.ambassadorTypesAllowed.map((key) => (
                <Badge key={key} variant="outline" className="font-normal">
                  {typeLabel(key)}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Promoting <span className="font-medium text-foreground">{contest?.title ?? '—'}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={reportHref}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Full Report
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSaveTemplateOpen(true)}>
              <BookmarkPlus className="h-4 w-4 mr-2" />
              Save as Template
            </Button>
            <Button size="sm" onClick={() => openManage('settings')}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Campaign
            </Button>
          </div>
        </div>

        <WidgetErrorBoundary name="Timeline & Phase">
          <Card className={cn(CARD, 'gap-2')}>
            <CardHeader>
              <CardTitle className="text-base">Timeline &amp; Phase</CardTitle>
            </CardHeader>
            <CardContent>
              <DesktopPhaseTracker phases={campaign.phases ?? []} />
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        <WidgetErrorBoundary name="Campaign Stats">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={Users}
              label="Ambassadors"
              value={ambassadorCount.toLocaleString()}
              context={capacity.totalAmbassadorTarget ? `of ${capacity.totalAmbassadorTarget.toLocaleString()} target` : undefined}
              progressPercent={capacity.totalAmbassadorTarget ? Math.min(100, (ambassadorCount / capacity.totalAmbassadorTarget) * 100) : undefined}
            />
            <StatCard
              icon={BarChart3}
              label="Registrations"
              value={totalRegistrations.toLocaleString()}
              context={
                capacity.totalRegistrationTarget
                  ? `${Math.round((totalRegistrations / capacity.totalRegistrationTarget) * 100)}% of ${capacity.totalRegistrationTarget.toLocaleString()} target`
                  : undefined
              }
              progressPercent={capacity.totalRegistrationTarget ? Math.min(100, (totalRegistrations / capacity.totalRegistrationTarget) * 100) : undefined}
            />
            <StatCard icon={Wallet} label="Accrued Payout" value={<Rupees amount={totalAccrued} />} context="Across all ambassadors so far" />
            <StatCard icon={TrendingUp} label="Avg / Ambassador" value={avgRegistrationsPerAmbassador.toFixed(1)} context="Registrations per ambassador" />
          </div>
        </WidgetErrorBoundary>

        <div className="grid grid-cols-1 lg:grid-cols-[13fr_7fr] gap-3 items-start">
          <div className="space-y-3 min-w-0">
            <WidgetErrorBoundary name="Top Ambassadors">
              <TopAmbassadorsCard rows={topAmbassadors} reportHref={reportHref} variant="table" />
            </WidgetErrorBoundary>

            {milestoneTiers.length > 0 && (
              <WidgetErrorBoundary name="Milestone Reach">
                <MilestoneReachCard ambassadorCount={ambassadorCount} tierDistribution={tierDistribution} />
              </WidgetErrorBoundary>
            )}

            {leaderboardCuts.length > 0 && (
              <WidgetErrorBoundary name="Leaderboards">
                <LeaderboardsCard
                  cuts={leaderboardCuts}
                  activeCutIndex={activeCutIndex}
                  onSelectCut={setActiveCutIndex}
                  previewRows={previewLeaderboardRows}
                  onManage={() => openManage('leaderboards')}
                />
              </WidgetErrorBoundary>
            )}

            <WidgetErrorBoundary name="Ambassador Kit">
              <AmbassadorKitCard
                shareTemplates={shareTemplates}
                whatsappTemplates={whatsappTemplates}
                primaryTemplate={primaryTemplate}
                contestTitle={contest?.title}
                onEdit={() => openManage('kit')}
              />
            </WidgetErrorBoundary>
          </div>

          <div className="space-y-3 min-w-0">
            <WidgetErrorBoundary name="Recently Joined">
              <RecentlyJoinedCard rows={recentlyJoined} />
            </WidgetErrorBoundary>

            <WidgetErrorBoundary name="Reward Budget">
              <RewardBudgetCard leaderboardBudget={leaderboardBudget} speedBonusBudget={speedBonusBudget} totalBudget={totalBudget} />
            </WidgetErrorBoundary>

            <WidgetErrorBoundary name="Ambassador Structure">
              <AmbassadorStructureCard capacity={capacity} ambassadorCount={ambassadorCount} />
            </WidgetErrorBoundary>

            <WidgetErrorBoundary name="Record">
              <RecordCard campaignId={id} status={campaign.status} publishedAt={campaign.publishedAt} updatedAt={campaign.updatedAt} />
            </WidgetErrorBoundary>
          </div>
        </div>
      </div>

      <Sheet open={manageOpen} onOpenChange={setManageOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[40vw] sm:min-w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                Edit {campaign.name}
                <Badge variant={CAMPAIGN_STATUS_BADGE_VARIANT[campaign.status]}>{campaign.status}</Badge>
              </div>
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <CampaignManagePanel campaign={campaign} activeTab={manageTab} onTabChange={setManageTab} />
          </div>
        </SheetContent>
      </Sheet>

      <SaveAsTemplateModal
        campaignId={id}
        campaignName={campaign.name}
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
      />
    </div>
  );
}
