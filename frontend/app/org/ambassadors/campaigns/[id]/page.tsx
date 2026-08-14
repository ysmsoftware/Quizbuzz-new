'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, BarChart3, Pencil, Users, Wallet, TrendingUp, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import { CampaignLifecycleActions } from '@/components/features/ambassador/dashboard/CampaignLifecycleActions';
import { CampaignManagePanel, type ManageTabKey } from '@/components/features/ambassador/dashboard/CampaignManagePanel';
import { substitutePlaceholders } from '@/components/features/ambassador/ShareTemplatesEditor';
import { leaderboardScopeKey } from '@/lib/types/ambassador';
import type { ApplicationReportRow, CampaignPhase } from '@/lib/types/ambassador';

// Ambassador counts/registrations come from the report endpoint (there's no dedicated
// aggregate-stats endpoint) — same pilot-scale tradeoff the CSV export already makes.
// pagination.total is exact regardless of this limit; sums/rankings below are only exact up
// to it, with a caveat shown if a campaign's ambassador count exceeds it.
const REPORT_SAMPLE_LIMIT = 500;
const TOP_AMBASSADOR_COUNT = 5;
const RECENT_JOIN_COUNT = 4;

function formatPaise(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : '—';
}

function initials(firstName: string, lastName: string | null) {
  return `${firstName[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

function StatCard({
  icon: Icon,
  label,
  value,
  context,
  progressPercent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  context?: string;
  progressPercent?: number;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
        <p className="text-2xl font-semibold text-foreground tracking-tight tabular-nums">{value}</p>
        {context && <p className="text-[11px] text-muted-foreground mt-1">{context}</p>}
        {progressPercent !== undefined && <Progress value={progressPercent} className="h-1 mt-2" />}
      </CardContent>
    </Card>
  );
}

/** Horizontal segmented tracker of the campaign's saved phase snapshot — the same phases
 *  generated at publish time by campaign-timeline.ts, not recomputed here. A phase is
 *  "current" when now falls within [startsAt, endsAt); everything before is done. */
function PhaseTracker({ phases }: { phases: CampaignPhase[] }) {
  if (phases.length === 0) {
    return <p className="text-sm text-muted-foreground">Timeline not set.</p>;
  }

  const now = Date.now();
  const hasStarted = now >= new Date(phases[0]!.startsAt).getTime();
  const hasEnded = now >= new Date(phases[phases.length - 1]!.endsAt).getTime();
  const totalMs = new Date(phases[phases.length - 1]!.endsAt).getTime() - new Date(phases[0]!.startsAt).getTime();
  const dayOfCampaign = hasStarted ? Math.min(Math.ceil((now - new Date(phases[0]!.startsAt).getTime()) / 86_400_000), Math.ceil(totalMs / 86_400_000)) : 0;
  const totalDays = Math.ceil(totalMs / 86_400_000);
  const currentPhase = phases.find((p) => now >= new Date(p.startsAt).getTime() && now < new Date(p.endsAt).getTime());

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <p className="text-xs text-muted-foreground">
          {!hasStarted
            ? "This campaign hasn't started yet."
            : hasEnded
              ? 'All phases have completed.'
              : (
                <>
                  Day {dayOfCampaign} of {totalDays}
                  {currentPhase && (
                    <>
                      {' '}— currently in <span className="font-medium text-primary">{currentPhase.label}</span>
                    </>
                  )}
                </>
              )}
        </p>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
        {phases.map((phase) => {
          const start = new Date(phase.startsAt).getTime();
          const end = new Date(phase.endsAt).getTime();
          const state: 'done' | 'current' | 'upcoming' = now < start ? 'upcoming' : now >= end ? 'done' : 'current';
          const fillPercent = state === 'current' ? Math.min(100, Math.round(((now - start) / (end - start)) * 100)) : 0;
          return (
            <div key={phase.key} className="h-1.5 rounded-full bg-muted overflow-hidden relative">
              {state === 'done' && <div className="absolute inset-0 bg-primary" />}
              {state === 'current' && <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${fillPercent}%` }} />}
            </div>
          );
        })}
      </div>
      <div className="grid gap-1 mt-2" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
        {phases.map((phase) => {
          const end = new Date(phase.endsAt).getTime();
          const isPast = now >= end;
          return (
            <div key={phase.key} className="min-w-0">
              <p className={cn('text-[11px] font-medium truncate', !isPast && 'text-muted-foreground')}>{phase.label}</p>
              <p className="text-[10px] text-muted-foreground truncate">{new Date(phase.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AmbassadorCell({ row }: { row: ApplicationReportRow }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="h-7 w-7 rounded-full bg-primary/15 text-primary text-[11px] font-semibold flex items-center justify-center shrink-0">
        {initials(row.firstName, row.lastName)}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {row.firstName} {row.lastName}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{row.email}</p>
      </div>
    </div>
  );
}

/**
 * Campaign Overview — the default landing page for a specific campaign, read-only by design.
 * Shows what's actually happening (status, current phase, ambassador/registration counts,
 * top performers, reward budget, kit assets) without exposing any editable fields; "Edit
 * Campaign" is the one deliberate way to reach the tabbed editor at [id]/manage.
 */
export default function CampaignOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { campaign, isLoading } = useOrgAmbassadorCampaign(id);
  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');
  const typeLabel = (key: string) => types.find((t) => t.key === key)?.label ?? key;

  // "Edit Campaign" and the Leaderboards/Kit cards' quick-edit links all open the same tabbed
  // editor in a drawer instead of navigating to the standalone /manage page — same panel,
  // opened to whichever tab is relevant.
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<ManageTabKey>('settings');
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

  const { rows: reportRows, pagination: reportPagination } = useOrgAmbassadorReport(id, { limit: REPORT_SAMPLE_LIMIT, sortBy: 'registrationCount', sortOrder: 'desc' });
  const ambassadorCount = reportPagination?.total ?? 0;
  const totalRegistrations = reportRows.reduce((sum, r) => sum + r.registrationCount, 0);
  const totalAccrued = reportRows.reduce((sum, r) => sum + r.accruedAmount, 0);
  const registrationsTruncated = ambassadorCount > reportRows.length;
  const avgRegistrationsPerAmbassador = ambassadorCount > 0 ? totalRegistrations / ambassadorCount : 0;

  const topAmbassadors = reportRows.slice(0, TOP_AMBASSADOR_COUNT);
  const recentlyJoined = useMemo(
    () => [...reportRows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, RECENT_JOIN_COUNT),
    [reportRows]
  );

  const rewardConfig = campaign?.rewardConfig;
  const milestoneTiers = rewardConfig?.milestoneTiers ?? [];
  const tierDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of reportRows) counts.set(row.currentTierLabel ?? 'No tier yet', (counts.get(row.currentTierLabel ?? 'No tier yet') ?? 0) + 1);
    const orderedLabels = milestoneTiers.map((t) => t.label).filter((l): l is string => !!l && counts.has(l));
    const remaining = [...counts.keys()].filter((l) => !orderedLabels.includes(l) && l !== 'No tier yet');
    const labels = [...orderedLabels, ...remaining, ...(counts.has('No tier yet') ? ['No tier yet'] : [])];
    const maxCount = Math.max(...counts.values(), 1);
    return labels.map((label) => ({ label, count: counts.get(label) ?? 0, percent: Math.round(((counts.get(label) ?? 0) / maxCount) * 100) }));
  }, [reportRows, milestoneTiers]);

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
      router.replace(`/org/ambassadors/campaigns/${id}/wizard`);
    }
  }, [campaign, id, router]);

  if (isLoading || !campaign || campaign.status === 'DRAFT') {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const speedBonusOn = !!rewardConfig?.speedBonus?.enabled;
  const speedBonusBudgetPaise = speedBonusOn
    ? (rewardConfig?.speedBonus?.tiers ?? []).reduce((acc, t) => acc + (t.maxWinners ? t.maxWinners * t.bonusAmount : t.bonusAmount), 0)
    : 0;
  const leaderboardBudgetPaise = leaderboardCuts.reduce((accCut, cut) => {
    const rankSum = (cut.ranks ?? []).reduce((accRank, r) => accRank + (r.cashAmount ?? 0) + (r.goodie?.cashEquivalent ?? 0), 0);
    return accCut + rankSum + (cut.consolation?.cashAmount ?? 0);
  }, 0);
  const totalBudgetPaise = speedBonusBudgetPaise + leaderboardBudgetPaise;
  const leaderboardBudgetPercent = totalBudgetPaise > 0 ? Math.round((leaderboardBudgetPaise / totalBudgetPaise) * 100) : 0;

  const shareTemplates = campaign.shareTemplates;
  const whatsappTemplates = shareTemplates.whatsappTemplates ?? (shareTemplates.whatsappText ? [{ id: 'legacy', label: 'Default', text: shareTemplates.whatsappText, includePoster: true }] : []);
  const primaryTemplate = whatsappTemplates[0];

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push('/org/ambassadors/campaigns')}>
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
            <Link href={`/org/ambassadors/campaigns/${id}/report`}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Full Report
            </Link>
          </Button>
          <Button size="sm" onClick={() => openManage('settings')}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Campaign
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Timeline &amp; Phase</CardTitle>
        </CardHeader>
        <CardContent>
          <PhaseTracker phases={campaign.phases ?? []} />
        </CardContent>
      </Card>

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
              : registrationsTruncated
                ? `From first ${reportRows.length} ambassadors`
                : undefined
          }
          progressPercent={capacity.totalRegistrationTarget ? Math.min(100, (totalRegistrations / capacity.totalRegistrationTarget) * 100) : undefined}
        />
        <StatCard icon={Wallet} label="Accrued Payout" value={formatPaise(totalAccrued)} context="Across all ambassadors so far" />
        <StatCard icon={TrendingUp} label="Avg / Ambassador" value={avgRegistrationsPerAmbassador.toFixed(1)} context="Registrations per ambassador" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Card className="border-border/50">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ranked by registrations</p>
                <CardTitle className="text-base">Top Ambassadors</CardTitle>
              </div>
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link href={`/org/ambassadors/campaigns/${id}/report`}>View full report →</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {topAmbassadors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ambassadors have joined yet.</p>
              ) : (
                <div className="space-y-1">
                  {topAmbassadors.map((row, i) => (
                    <div key={row.ambassadorId} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                      <span className="text-xs font-semibold text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <AmbassadorCell row={row} />
                      </div>
                      {row.currentTierLabel && (
                        <Badge variant="secondary" className="font-normal hidden sm:inline-flex">
                          {row.currentTierLabel}
                        </Badge>
                      )}
                      <span className="text-sm tabular-nums text-right w-14">{row.registrationCount}</span>
                      <span className="text-sm font-medium tabular-nums text-right w-20">{formatPaise(row.accruedAmount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {milestoneTiers.length > 0 && (
            <Card className="border-border/50">
              <CardHeader>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{ambassadorCount} ambassadors, grouped by current tier</p>
                <CardTitle className="text-base">Milestone Reach</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {tierDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No ambassadors have reached a tier yet.</p>
                ) : (
                  tierDistribution.map((t) => (
                    <div key={t.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('text-sm font-medium truncate', t.label === 'No tier yet' && 'text-muted-foreground font-normal')}>{t.label}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums w-8 text-right">{t.count}</span>
                      <div className="col-span-2 h-2 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full', t.label === 'No tier yet' ? 'bg-muted-foreground/40' : 'bg-primary')} style={{ width: `${t.percent}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {leaderboardCuts.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{leaderboardCuts.length} leaderboard{leaderboardCuts.length === 1 ? '' : 's'} configured</p>
                  <CardTitle className="text-base">Leaderboards</CardTitle>
                </div>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => openManage('leaderboards')}>
                  Manage →
                </Button>
              </CardHeader>
              <CardContent>
                {leaderboardCuts.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {leaderboardCuts.map((cut, i) => (
                      <button
                        key={leaderboardScopeKey(cut.scope)}
                        type="button"
                        onClick={() => setActiveCutIndex(i)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                          i === activeCutIndex ? 'bg-primary text-primary-foreground border-transparent' : 'border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {cut.label}
                      </button>
                    ))}
                  </div>
                )}
                {previewLeaderboardRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rankings yet for {activeCut?.label}.</p>
                ) : (
                  <div className="space-y-1">
                    {previewLeaderboardRows.map((row) => (
                      <div key={row.groupKey} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0">
                        <div className={cn('h-5.5 w-5.5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0', row.rank === 1 ? 'bg-warning/25 text-warning' : 'bg-muted text-muted-foreground')}>
                          {row.rank}
                        </div>
                        <span className="text-sm font-medium flex-1 truncate">{row.label}</span>
                        <span className="text-xs text-muted-foreground">{row.registrationCount} regs</span>
                        {row.prize && (
                          <span className="text-xs font-semibold text-primary min-w-[56px] text-right">
                            {row.prize.cashAmount ? formatPaise(row.prize.cashAmount) : row.prize.label ?? row.prize.goodie?.label}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4 min-w-0">
          {totalBudgetPaise > 0 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Reward Budget</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-2 rounded-full overflow-hidden flex bg-muted mb-3">
                  {leaderboardBudgetPaise > 0 && <div className="h-full bg-chart-1" style={{ width: `${leaderboardBudgetPercent}%` }} />}
                  {speedBonusBudgetPaise > 0 && <div className="h-full bg-chart-4" style={{ width: `${100 - leaderboardBudgetPercent}%` }} />}
                </div>
                <div className="space-y-2 text-sm">
                  {leaderboardBudgetPaise > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-chart-1 shrink-0" />Leaderboard prizes</span>
                      <span className="font-medium tabular-nums">{formatPaise(leaderboardBudgetPaise)}</span>
                    </div>
                  )}
                  {speedBonusBudgetPaise > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-chart-4 shrink-0" />Speed bonus</span>
                      <span className="font-medium tabular-nums">{formatPaise(speedBonusBudgetPaise)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-border/40">
                  <span className="text-xs text-muted-foreground">Estimated total</span>
                  <span className="text-lg font-bold tabular-nums">{formatPaise(totalBudgetPaise)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Ambassador Kit</CardTitle>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => openManage('kit')}>
                Edit →
              </Button>
            </CardHeader>
            <CardContent>
              {shareTemplates.posterImageUrl ? (
                <img src={shareTemplates.posterImageUrl} alt="Campaign poster" className="w-full aspect-[4/5] object-cover rounded-lg border border-border/50 mb-3" />
              ) : (
                <div className="w-full aspect-[4/5] rounded-lg border border-dashed border-border flex items-center justify-center mb-3">
                  <p className="text-xs text-muted-foreground">No poster uploaded</p>
                </div>
              )}
              <div className="flex items-center justify-between py-1.5 text-sm border-b border-border/40">
                <span className="text-muted-foreground">WhatsApp templates</span>
                <span className="font-medium">{whatsappTemplates.length ? `${whatsappTemplates.length} active` : '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-muted-foreground">Instagram caption</span>
                <span className="font-medium">{shareTemplates.instagramText ? 'Set' : '—'}</span>
              </div>
              {primaryTemplate && (
                <div className="mt-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{primaryTemplate.label} · sample preview</p>
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{substitutePlaceholders(primaryTemplate.text, contest?.title)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Ambassador Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted-foreground">Groups</span>
                <span className="font-semibold">{capacity.groupCount || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted-foreground">Ambassador target</span>
                <span className="font-semibold tabular-nums">{capacity.totalAmbassadorTarget ? capacity.totalAmbassadorTarget.toLocaleString() : '—'}</span>
              </div>
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted-foreground">Registration target</span>
                <span className="font-semibold tabular-nums">{capacity.totalRegistrationTarget ? capacity.totalRegistrationTarget.toLocaleString() : '—'}</span>
              </div>
              {capacity.totalAmbassadorTarget > 0 && <Progress value={Math.min(100, (ambassadorCount / capacity.totalAmbassadorTarget) * 100)} className="h-1 mt-2" />}
            </CardContent>
          </Card>

          {recentlyJoined.length > 0 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Recently Joined</CardTitle>
              </CardHeader>
              <CardContent>
                {recentlyJoined.map((row) => (
                  <div key={row.ambassadorId} className="flex gap-2.5 py-2 border-b border-border/40 last:border-0">
                    <Trophy className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-foreground truncate">
                        <span className="font-semibold">{row.firstName} {row.lastName}</span> joined as an ambassador
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Record</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted-foreground">Published</span>
                <span className="font-medium">{formatDate(campaign.publishedAt)}</span>
              </div>
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted-foreground">Last updated</span>
                <span className="font-medium">{formatDate(campaign.updatedAt)}</span>
              </div>
              {campaign.status !== 'ARCHIVED' ? (
                <div className="mt-3 pt-3 border-t border-border/40">
                  <CampaignLifecycleActions campaignId={id} status={campaign.status} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/40">This campaign is archived — no further actions are available.</p>
              )}
            </CardContent>
          </Card>
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
    </div>
  );
}
