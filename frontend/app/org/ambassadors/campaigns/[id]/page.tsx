'use client';

import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Pencil, Users, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { listContests } from '@/lib/api/contests.api';
import { useOrgAmbassadorCampaign, useOrgAmbassadorCampaignGroups } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { useOrgAmbassadorReport } from '@/lib/hooks/useOrgAmbassadorReport';
import { CAMPAIGN_STATUS_BADGE_VARIANT } from '@/components/features/ambassador/campaign-status';
import { calculateCampaignCapacity } from '@/components/features/ambassador/campaign-capacity';
import { CampaignLifecycleActions } from '@/components/features/ambassador/dashboard/CampaignLifecycleActions';
import { SummaryRow } from '@/components/features/ambassador/dashboard/ReadOnlySummary';
import type { CampaignPhase } from '@/lib/types/ambassador';

// Ambassador counts/registrations come from the report endpoint (there's no dedicated
// aggregate-stats endpoint) — same pilot-scale tradeoff the CSV export already makes.
// pagination.total is exact regardless of this limit; the registration sum below is only
// exact up to it, with a caveat shown if a campaign's ambassador count exceeds it.
const REPORT_SAMPLE_LIMIT = 500;

function formatPaise(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : '—';
}

function StatCard({ icon: Icon, label, value, hint }: { icon: ComponentType<{ className?: string }>; label: string; value: string; hint?: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-4 pb-4 flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold text-foreground leading-tight">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Visual stepper of the campaign's saved phase snapshot — the same phases generated at
 *  publish time by campaign-timeline.ts, not recomputed here. A phase is "current" when now
 *  falls within [startsAt, endsAt); everything before is done, everything after is upcoming. */
function PhaseTimeline({ phases }: { phases: CampaignPhase[] }) {
  if (phases.length === 0) {
    return <p className="text-sm text-muted-foreground">Timeline not set.</p>;
  }

  const now = Date.now();
  const hasStarted = now >= new Date(phases[0]!.startsAt).getTime();
  const hasEnded = now >= new Date(phases[phases.length - 1]!.endsAt).getTime();

  return (
    <div>
      {!hasStarted && <p className="text-xs text-muted-foreground mb-3">This campaign hasn&apos;t started yet.</p>}
      {hasEnded && <p className="text-xs text-muted-foreground mb-3">All phases have completed.</p>}
      {phases.map((phase, i) => {
        const start = new Date(phase.startsAt).getTime();
        const end = new Date(phase.endsAt).getTime();
        const state: 'done' | 'current' | 'upcoming' = now < start ? 'upcoming' : now >= end ? 'done' : 'current';
        const isLast = i === phases.length - 1;
        return (
          <div key={phase.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'h-3 w-3 rounded-full border-2 shrink-0 mt-1',
                  state === 'done' && 'bg-primary border-primary',
                  state === 'current' && 'bg-background border-primary ring-4 ring-primary/20',
                  state === 'upcoming' && 'bg-background border-border',
                )}
              />
              {!isLast && <div className={cn('w-px flex-1 min-h-[24px]', state === 'done' ? 'bg-primary' : 'bg-border')} />}
            </div>
            <div className={cn('pb-4', state === 'upcoming' && 'opacity-60')}>
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-medium', state === 'current' && 'text-primary')}>{phase.label}</span>
                {state === 'current' && <Badge className="h-5 text-[10px]">Current phase</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(phase.startsAt).toLocaleDateString()} – {new Date(phase.endsAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Campaign Overview — the default landing page for a specific campaign, read-only by design.
 * Shows what's actually happening (status, current phase, ambassador/registration counts,
 * reward budget) without exposing any editable fields; "Edit Campaign" is the one deliberate
 * way to reach the tabbed editor at [id]/manage. Mirrors how Contest already separates its
 * public-facing overview from its edit form.
 */
export default function CampaignOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { campaign, isLoading } = useOrgAmbassadorCampaign(id);
  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');
  const typeLabel = (key: string) => types.find((t) => t.key === key)?.label ?? key;

  const { data: contestsRes } = useQuery({
    queryKey: ['contests', 'list', { limit: 100 }],
    queryFn: () => listContests({ limit: 100 }),
    enabled: !!activeOrg?.id,
  });
  const contest = contestsRes?.data?.data?.find((c) => c.id === campaign?.contestId);

  const { groups, capacity: rawCapacity } = useOrgAmbassadorCampaignGroups(id);
  const capacity = rawCapacity ?? calculateCampaignCapacity(groups);

  const { rows: reportRows, pagination: reportPagination } = useOrgAmbassadorReport(id, { limit: REPORT_SAMPLE_LIMIT });
  const ambassadorCount = reportPagination?.total ?? 0;
  const totalRegistrations = reportRows.reduce((sum, r) => sum + r.registrationCount, 0);
  const registrationsTruncated = ambassadorCount > reportRows.length;

  // A DRAFT campaign's home is the creation wizard, not this overview — redirect if someone
  // lands here directly (e.g. a stale bookmark from before it was published).
  useEffect(() => {
    if (campaign && campaign.status === 'DRAFT') {
      router.replace(`/org/ambassadors/campaigns/${id}/wizard`);
    }
  }, [campaign, id, router]);

  if (isLoading || !campaign || campaign.status === 'DRAFT') {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const rewardConfig = campaign.rewardConfig;
  const milestoneTierCount = rewardConfig.milestoneTiers?.length ?? 0;
  const leaderboardCount = rewardConfig.leaderboardPrizes?.length ?? 0;
  const speedBonusOn = !!rewardConfig.speedBonus?.enabled;

  const speedBonusBudgetPaise = speedBonusOn
    ? (rewardConfig.speedBonus?.tiers ?? []).reduce((acc, t) => acc + (t.maxWinners ? t.maxWinners * t.bonusAmount : t.bonusAmount), 0)
    : 0;
  const leaderboardBudgetPaise = (rewardConfig.leaderboardPrizes ?? []).reduce((accCut, cut) => {
    const rankSum = (cut.ranks ?? []).reduce((accRank, r) => accRank + (r.cashAmount ?? 0) + (r.goodie?.cashEquivalent ?? 0), 0);
    return accCut + rankSum + (cut.consolation?.cashAmount ?? 0);
  }, 0);
  const totalBudgetPaise = speedBonusBudgetPaise + leaderboardBudgetPaise;

  const shareTemplates = campaign.shareTemplates;
  const whatsappTemplateCount = shareTemplates.whatsappTemplates?.length ?? (shareTemplates.whatsappText ? 1 : 0);

  return (
    <div className="max-w-3xl space-y-6">
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
              Report
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/org/ambassadors/campaigns/${id}/manage`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Campaign
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Ambassadors" value={String(ambassadorCount)} />
        <StatCard
          icon={BarChart3}
          label="Registrations"
          value={totalRegistrations.toLocaleString()}
          hint={registrationsTruncated ? `From first ${reportRows.length} ambassadors` : undefined}
        />
        <StatCard icon={Gift} label="Milestone Tiers" value={String(milestoneTierCount)} />
        <StatCard icon={Gift} label="Speed Bonus" value={speedBonusOn ? 'On' : 'Off'} />
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Timeline &amp; Phase</CardTitle>
        </CardHeader>
        <CardContent>
          <SummaryRow label="Campaign Dates" value={campaign.startDate && campaign.endDate ? `${formatDate(campaign.startDate)} – ${formatDate(campaign.endDate)}` : 'Not set'} />
          <div className="pt-3 mt-1 border-t border-border/40">
            <PhaseTimeline phases={campaign.phases ?? []} />
          </div>
        </CardContent>
      </Card>

      {totalBudgetPaise > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Reward Budget</CardTitle>
          </CardHeader>
          <CardContent>
            {speedBonusBudgetPaise > 0 && <SummaryRow label="Speed Bonus Budget" value={formatPaise(speedBonusBudgetPaise)} />}
            {leaderboardBudgetPaise > 0 && <SummaryRow label="Leaderboard Prizes Budget" value={formatPaise(leaderboardBudgetPaise)} />}
            <div className="pt-2 mt-1 border-t border-border/40">
              <SummaryRow label="Estimated Total" value={formatPaise(totalBudgetPaise)} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Ambassador Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <SummaryRow label="Groups" value={capacity.groupCount ? String(capacity.groupCount) : '—'} />
          <SummaryRow label="Ambassador Target" value={capacity.totalAmbassadorTarget ? String(capacity.totalAmbassadorTarget) : '—'} />
          <SummaryRow label="Registration Target" value={capacity.totalRegistrationTarget ? capacity.totalRegistrationTarget.toLocaleString() : '—'} />
          <SummaryRow label="Leaderboards" value={leaderboardCount ? String(leaderboardCount) : '—'} />
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Ambassador Kit</CardTitle>
        </CardHeader>
        <CardContent>
          <SummaryRow label="Message templates" value={whatsappTemplateCount ? String(whatsappTemplateCount) : '—'} />
          <SummaryRow label="Instagram caption" value={shareTemplates.instagramText ? 'Set' : '—'} />
          <SummaryRow label="Poster image" value={shareTemplates.posterImageUrl ? 'Set' : '—'} />
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Record</CardTitle>
        </CardHeader>
        <CardContent>
          <SummaryRow label="Published" value={formatDate(campaign.publishedAt)} />
          <SummaryRow label="Last updated" value={formatDate(campaign.updatedAt)} />
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignLifecycleActions campaignId={id} status={campaign.status} />
          {campaign.status === 'ARCHIVED' && <p className="text-sm text-muted-foreground">This campaign is archived — no further actions are available.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
