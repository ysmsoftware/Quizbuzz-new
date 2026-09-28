'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { useOrgAmbassadorReport, useOrgAmbassadorReportSummary } from '@/lib/hooks/useOrgAmbassadorReport';
import { type ReportFilters, type ReportPeriodFilters } from '@/lib/api/ambassador-campaign.api';
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { ambassadorCampaignApi } from '@/lib/api/ambassador-campaign.api';
import { LeaderboardTable } from '@/components/features/ambassador/LeaderboardTable';
import { leaderboardScopeKey, type ApplicationFieldDef } from '@/lib/types/ambassador';
import { Rupees } from '@/components/features/ambassador/Rupees';
import { ReferralListDialog } from '@/components/features/ambassador/ReferralListDialog';
import { ReportSummaryStrip, PayoutLiabilityCard, ReferralQualityCard, ApplicationsCard } from './report-cards';
import { cn } from '@/lib/utils';

// Leaderboard groups computed live from referral counts — 30s keeps rows fresh without a
// request on every render; matches the backend's own 20s group cache.
const LEADERBOARD_STALE_MS = 20_000;
const LEADERBOARD_REFETCH_MS = 30_000;

type PeriodKey = 'all' | '24h' | '7d' | '30d' | 'custom';
const PERIOD_OPTIONS: { key: PeriodKey; label: string; ms?: number }[] = [
  { key: 'all', label: 'All time' },
  { key: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: '30 days', ms: 30 * 24 * 60 * 60 * 1000 },
  { key: 'custom', label: 'Custom' },
];

type SortKey = 'registrations' | 'paid' | 'owed' | 'name' | 'joined';
const SORT_OPTIONS: Record<SortKey, { label: string; sortBy: NonNullable<ReportFilters['sortBy']>; sortOrder: 'asc' | 'desc' }> = {
  registrations: { label: 'Most registrations', sortBy: 'registrationCount', sortOrder: 'desc' },
  paid: { label: 'Most paid', sortBy: 'paidCount', sortOrder: 'desc' },
  owed: { label: 'Highest owed', sortBy: 'accruedAmount', sortOrder: 'desc' },
  name: { label: 'Name (A–Z)', sortBy: 'name', sortOrder: 'asc' },
  joined: { label: 'Newest joined', sortBy: 'createdAt', sortOrder: 'desc' },
};

/** Custom range → [start of first day, start of the day after the last), in the viewer's timezone. */
function customRangeToPeriod(range: DateRangeValue): ReportPeriodFilters {
  const from = new Date(`${range.start}T00:00:00`);
  const to = new Date(`${range.end}T00:00:00`);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function AmbassadorCampaignReportPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [page, setPage] = useState(1);
  const [periodKey, setPeriodKey] = useState<PeriodKey>('all');
  const [customRange, setCustomRange] = useState<DateRangeValue | null>(null);
  // `from` is fixed when a preset is picked, not recomputed per render — otherwise the query
  // key would change every render and refetch forever.
  const [period, setPeriod] = useState<ReportPeriodFilters>({});
  const [sortKey, setSortKey] = useState<SortKey>('registrations');
  const sort = SORT_OPTIONS[sortKey];

  const selectPeriod = (key: PeriodKey) => {
    setPeriodKey(key);
    setPage(1);
    const option = PERIOD_OPTIONS.find((o) => o.key === key);
    if (option?.ms) setPeriod({ from: new Date(Date.now() - option.ms).toISOString() });
    else if (key === 'custom') setPeriod(customRange ? customRangeToPeriod(customRange) : {});
    else setPeriod({});
  };

  const { campaign } = useOrgAmbassadorCampaign(campaignId);
  const { rows, pagination, isLoading, exportUrl } = useOrgAmbassadorReport(campaignId, {
    page,
    limit: 20,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
    ...period,
  });
  const { summary } = useOrgAmbassadorReportSummary(campaignId, period);
  const periodActive = !!(period.from || period.to);
  const [referralsFor, setReferralsFor] = useState<{ enrollmentId: string; name: string } | null>(null);

  const cuts = useMemo(() => campaign?.rewardConfig.leaderboardPrizes ?? [], [campaign]);
  const [activeCutKey, setActiveCutKey] = useState<string | null>(null);
  const activeCut = cuts.find((c) => leaderboardScopeKey(c.scope) === activeCutKey) ?? cuts[0] ?? null;

  // Detect whether the active cut's field depends on another (e.g. Department depends on
  // College) — the same dependsOnKey metadata that already cascades the Department dropdown
  // off the selected College on the application form. A dependent cut can only be viewed
  // scoped to one value of its parent field, never flat across all of them.
  const { types: ambassadorTypes } = useAmbassadorTypes(campaign?.organizationId ?? '');
  const fieldDefsByKey = useMemo(() => {
    const map = new Map<string, ApplicationFieldDef>();
    for (const t of ambassadorTypes) {
      if (!campaign?.ambassadorTypesAllowed.includes(t.key)) continue;
      for (const f of t.applicationFields) {
        if (!map.has(f.key)) map.set(f.key, f);
      }
    }
    return map;
  }, [ambassadorTypes, campaign]);

  // The application fields the org ranks by (e.g. College, Department) — shown as one column.
  const groupFieldKeys = useMemo(
    () => [...new Set(cuts.flatMap((c) => (c.scope.kind === 'APPLICATION_FIELD_GROUP' ? (c.scope.groupByFieldKeys ?? []) : [])))],
    [cuts],
  );

  const activeFieldKey =
    activeCut?.scope.kind === 'APPLICATION_FIELD_GROUP' && activeCut.scope.groupByFieldKeys?.length === 1
      ? activeCut.scope.groupByFieldKeys[0]
      : null;
  const parentKey = activeFieldKey ? (fieldDefsByKey.get(activeFieldKey)?.dependsOnKey ?? null) : null;
  const parentFieldLabel = parentKey ? (fieldDefsByKey.get(parentKey)?.label ?? parentKey) : null;
  const parentCut = parentKey
    ? (cuts.find((c) => c.scope.kind === 'APPLICATION_FIELD_GROUP' && c.scope.groupByFieldKeys?.length === 1 && c.scope.groupByFieldKeys[0] === parentKey) ?? null)
    : null;

  const [parentValue, setParentValue] = useState<string | null>(null);
  useEffect(() => setParentValue(null), [activeCutKey]);

  // Picker options for a dependent cut — reuses the sibling cut's own rows (e.g. the College
  // leaderboard) instead of a separate "list values" endpoint, and only fetches once a
  // dependent cut is actually selected, never upfront for every cut.
  const { data: parentOptionsRes, isLoading: parentOptionsLoading } = useQuery({
    queryKey: ['org-ambassador-leaderboard', campaignId, parentCut ? leaderboardScopeKey(parentCut.scope) : null, 'picker'],
    queryFn: () => ambassadorCampaignApi.getLeaderboard(campaignId, (parentCut as NonNullable<typeof parentCut>).scope, { limit: 50 }),
    enabled: !!parentCut,
    staleTime: LEADERBOARD_STALE_MS,
  });
  const parentOptions = useMemo(() => parentOptionsRes?.data?.data ?? [], [parentOptionsRes]);

  useEffect(() => {
    if (parentKey && parentValue === null && parentOptions.length > 0) setParentValue(parentOptions[0]!.label);
  }, [parentKey, parentValue, parentOptions]);

  const { data: leaderboardRes, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['org-ambassador-leaderboard', campaignId, activeCut ? leaderboardScopeKey(activeCut.scope) : null, parentKey ? parentValue : null],
    queryFn: () =>
      ambassadorCampaignApi.getLeaderboard(campaignId, (activeCut as NonNullable<typeof activeCut>).scope, {
        limit: 10,
        ...(parentKey ? { parentValue: parentValue ?? undefined } : {}),
      }),
    enabled: !!activeCut && (!parentKey || !!parentValue),
    staleTime: LEADERBOARD_STALE_MS,
    refetchInterval: LEADERBOARD_REFETCH_MS,
  });

  const leaderboards = cuts.length > 0 && activeCut && (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold">Leaderboards</h2>
      <Tabs value={leaderboardScopeKey(activeCut.scope)} onValueChange={setActiveCutKey}>
        <TabsList className="w-full flex-wrap h-auto">
          {cuts.map((c) => (
            <TabsTrigger key={leaderboardScopeKey(c.scope)} value={leaderboardScopeKey(c.scope)} className="flex-1">
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={leaderboardScopeKey(activeCut.scope)} className="mt-3 space-y-3">
          {parentKey && (
            parentCut ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Viewing:</span>
                {parentOptionsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select value={parentValue ?? undefined} onValueChange={setParentValue}>
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder={`Pick a ${parentFieldLabel ?? parentKey}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {parentOptions.map((o) => (
                        <SelectItem key={o.groupKey} value={o.label}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add a {parentFieldLabel ?? parentKey} leaderboard to enable this drill-down.
              </p>
            )
          )}
          <LeaderboardTable scope={activeCut.scope} label={activeCut.label} rows={leaderboardRes?.data?.data ?? []} isLoading={leaderboardLoading || (!!parentKey && !parentValue)} />
          <p className="text-[11px] text-muted-foreground">Always all-time — leaderboards decide prizes.</p>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push(`/org/campaigns/${campaignId}`)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Campaign
      </Button>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{campaign?.name ?? 'Campaign Report'}</h1>
          <p className="text-sm text-muted-foreground">Registrations, tiers, and accrued reward per ambassador</p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <a href={exportUrl}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </a>
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="inline-flex flex-wrap rounded-lg bg-muted p-1 gap-1" role="group" aria-label="Report period">
            {PERIOD_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={periodKey === o.key}
                onClick={() => selectPeriod(o.key)}
                className={cn(
                  'px-3 h-8 rounded-md text-xs font-medium transition-colors',
                  periodKey === o.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {periodKey === 'custom' && (
            <DateRangePicker
              label="Custom range"
              value={customRange}
              onChange={(range) => {
                setCustomRange(range);
                setPage(1);
                setPeriod(range ? customRangeToPeriod(range) : {});
              }}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort</span>
          <Select value={sortKey} onValueChange={(v) => { setSortKey(v as SortKey); setPage(1); }}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_OPTIONS) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>{SORT_OPTIONS[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ReportSummaryStrip summary={summary} periodActive={periodActive} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
        <div className="space-y-3 min-w-0">
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : rows.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <BarChart3 className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>No ambassadors yet</EmptyTitle>
              <EmptyDescription>Report rows appear once ambassadors join this campaign.</EmptyDescription>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ambassador</TableHead>
                    {groupFieldKeys.length > 0 && (
                      <TableHead>{groupFieldKeys.map((k) => fieldDefsByKey.get(k)?.label ?? k).join(' / ')}</TableHead>
                    )}
                    <TableHead className="text-right">Registrations</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right">Owed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const clickable = row.totalRegistrations > 0;
                    const [primaryField, ...restFields] = groupFieldKeys.map((k) => String(row.applicationData[k] ?? '')).filter(Boolean);
                    return (
                      <TableRow
                        key={row.ambassadorId}
                        className={clickable ? 'cursor-pointer hover:bg-muted/40' : undefined}
                        onClick={clickable ? () => setReferralsFor({ enrollmentId: row.enrollmentId, name: `${row.firstName} ${row.lastName ?? ''}`.trim() }) : undefined}
                      >
                        <TableCell className="max-w-[220px]">
                          <div className="font-medium truncate">{row.firstName} {row.lastName}</div>
                          <div className="text-xs text-muted-foreground truncate">{row.email}</div>
                        </TableCell>
                        {groupFieldKeys.length > 0 && (
                          <TableCell className="max-w-[220px]">
                            <div className="truncate" title={primaryField}>{primaryField ?? '—'}</div>
                            {restFields.length > 0 && <div className="text-xs text-muted-foreground truncate">{restFields.join(' · ')}</div>}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <span className={cn('tabular-nums', clickable && 'underline-offset-2 hover:underline')}>{row.registrationCount}</span>
                          {periodActive && <div className="text-[11px] text-muted-foreground tabular-nums">{row.totalRegistrations} total</div>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.paidCount}</TableCell>
                        <TableCell>{row.currentTierLabel ?? '—'}</TableCell>
                        <TableCell className="text-right text-muted-foreground"><Rupees amount={row.speedBonusAmount} /></TableCell>
                        <TableCell className="text-right font-semibold"><Rupees amount={row.accruedAmount} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {periodActive && rows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Registrations and Paid cover the selected period. Tier, Bonus and Owed are always all-time — rewards are earned on the running total.
            </p>
          )}

          {pagination && pagination.totalPages > 1 && (
            <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.limit} onPageChange={setPage} />
          )}
        </div>

        <div className="space-y-4 min-w-0">
          {leaderboards}
          <PayoutLiabilityCard summary={summary} />
          <ReferralQualityCard summary={summary} periodActive={periodActive} />
          <ApplicationsCard summary={summary} />
        </div>
      </div>

      {referralsFor && (
        <ReferralListDialog
          campaignId={campaignId}
          enrollmentId={referralsFor.enrollmentId}
          ambassadorName={referralsFor.name}
          onOpenChange={(open) => { if (!open) setReferralsFor(null); }}
        />
      )}
    </div>
  );
}
