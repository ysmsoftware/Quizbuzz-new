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
import { useOrgAmbassadorReport } from '@/lib/hooks/useOrgAmbassadorReport';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { ambassadorCampaignApi } from '@/lib/api/ambassador-campaign.api';
import { LeaderboardTable } from '@/components/features/ambassador/LeaderboardTable';
import { leaderboardScopeKey, type ApplicationFieldDef } from '@/lib/types/ambassador';
import { Rupees } from '@/components/features/ambassador/Rupees';
import { ReferralListDialog } from '@/components/features/ambassador/ReferralListDialog';
import { cn } from '@/lib/utils';

// Leaderboard groups computed live from referral counts — 30s keeps rows fresh without a
// request on every render; matches the backend's own 20s group cache.
const LEADERBOARD_STALE_MS = 20_000;
const LEADERBOARD_REFETCH_MS = 30_000;

export default function AmbassadorCampaignReportPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [page, setPage] = useState(1);
  const { campaign } = useOrgAmbassadorCampaign(campaignId);
  const { rows, pagination, isLoading, exportUrl } = useOrgAmbassadorReport(campaignId, { page, limit: 20 });
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

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push(`/org/campaigns/${campaignId}`)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Campaign
      </Button>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{campaign?.name ?? 'Campaign Report'}</h1>
          <p className="text-sm text-muted-foreground">Registrations, tiers, and accrued reward per ambassador</p>
        </div>
        <Button asChild variant="outline">
          <a href={exportUrl}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </a>
        </Button>
      </div>

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
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Registrations</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Accrued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const clickable = row.registrationCount > 0;
                return (
                  <TableRow
                    key={row.ambassadorId}
                    className={clickable ? 'cursor-pointer hover:bg-muted/40' : undefined}
                    onClick={clickable ? () => setReferralsFor({ enrollmentId: row.enrollmentId, name: `${row.firstName} ${row.lastName ?? ''}`.trim() }) : undefined}
                  >
                    <TableCell className="font-medium">
                      {row.firstName} {row.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.email}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn('tabular-nums', clickable && 'underline-offset-2 hover:underline')}>{row.registrationCount}</span>
                    </TableCell>
                    <TableCell>{row.currentTierLabel ?? '—'}</TableCell>
                    <TableCell className="text-right font-semibold"><Rupees amount={row.accruedAmount} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.limit} onPageChange={setPage} />
      )}

      {referralsFor && (
        <ReferralListDialog
          campaignId={campaignId}
          enrollmentId={referralsFor.enrollmentId}
          ambassadorName={referralsFor.name}
          onOpenChange={(open) => { if (!open) setReferralsFor(null); }}
        />
      )}

      {cuts.length > 0 && activeCut && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Leaderboards</h2>
          <Tabs value={leaderboardScopeKey(activeCut.scope)} onValueChange={setActiveCutKey}>
            <TabsList className="w-full flex-wrap h-auto">
              {cuts.map((c) => (
                <TabsTrigger key={leaderboardScopeKey(c.scope)} value={leaderboardScopeKey(c.scope)} className="flex-1">
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={leaderboardScopeKey(activeCut.scope)} className="mt-4 space-y-3">
              {parentKey && (
                parentCut ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">Viewing:</span>
                    {parentOptionsLoading ? (
                      <Skeleton className="h-9 w-full sm:w-64" />
                    ) : (
                      <Select value={parentValue ?? undefined} onValueChange={setParentValue}>
                        <SelectTrigger className="w-full sm:w-64">
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
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
