'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { useOrgAmbassadorReport } from '@/lib/hooks/useOrgAmbassadorReport';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { ambassadorCampaignApi } from '@/lib/api/ambassador-campaign.api';
import { LeaderboardTable } from '@/components/features/ambassador/LeaderboardTable';
import { leaderboardScopeKey } from '@/lib/types/ambassador';

function formatPaise(paise: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(paise / 100);
}

export default function AmbassadorCampaignReportPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [page, setPage] = useState(1);
  const { campaign } = useOrgAmbassadorCampaign(campaignId);
  const { rows, pagination, isLoading, exportUrl } = useOrgAmbassadorReport(campaignId, { page, limit: 20 });

  const cuts = useMemo(() => campaign?.rewardConfig.leaderboardPrizes ?? [], [campaign]);
  const [activeCutKey, setActiveCutKey] = useState<string | null>(null);
  const activeCut = cuts.find((c) => leaderboardScopeKey(c.scope) === activeCutKey) ?? cuts[0] ?? null;

  const { data: leaderboardRes, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['org-ambassador-leaderboard', campaignId, activeCut ? leaderboardScopeKey(activeCut.scope) : null],
    queryFn: () => ambassadorCampaignApi.getLeaderboard(campaignId, (activeCut as NonNullable<typeof activeCut>).scope, { limit: 10 }),
    enabled: !!activeCut,
  });

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push(`/org/ambassadors/campaigns/${campaignId}`)}>
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
              {rows.map((row) => (
                <TableRow key={row.ambassadorId}>
                  <TableCell className="font-medium">
                    {row.firstName} {row.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.email}</TableCell>
                  <TableCell className="text-right">{row.registrationCount}</TableCell>
                  <TableCell>{row.currentTierLabel ?? '—'}</TableCell>
                  <TableCell className="text-right font-semibold">{formatPaise(row.accruedAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.limit} onPageChange={setPage} />
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
            <TabsContent value={leaderboardScopeKey(activeCut.scope)} className="mt-4">
              <LeaderboardTable scope={activeCut.scope} label={activeCut.label} rows={leaderboardRes?.data?.data ?? []} isLoading={leaderboardLoading} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
