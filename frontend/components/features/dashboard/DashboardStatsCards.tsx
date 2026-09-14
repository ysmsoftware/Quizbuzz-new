'use client';

import { Trophy, Radio, Users, IndianRupee, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardOverview } from '@/lib/hooks/useDashboard';
import { DashboardWidgetError, formatCurrency } from './dashboard-shared';

interface Tile {
  key: string;
  label: string;
  icon: typeof Trophy;
  value: string;
  delta?: string;
  deltaLabel?: string;
}

export function DashboardStatsCards({ orgId, period }: { orgId: string; period: 'week' | 'month' }) {
  const { data, isLoading, isError, refetch, isFetching } = useDashboardOverview(orgId, period);
  const overview = data?.data;

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/50 py-4">
            <CardContent className="px-4 space-y-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <DashboardWidgetError message="Couldn't load your stats overview." onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  const periodLabel = period === 'week' ? 'this week' : 'this month';

  const tiles: Tile[] = [
    {
      key: 'registrations',
      label: 'Registrations',
      icon: Users,
      value: overview.registrations.total.toLocaleString('en-IN'),
      delta: overview.registrations.newThisPeriod > 0 ? `+${overview.registrations.newThisPeriod}` : undefined,
      deltaLabel: periodLabel,
    },
    {
      key: 'contests',
      label: 'Total contests',
      icon: Trophy,
      value: overview.contests.total.toLocaleString('en-IN'),
      delta: overview.contests.createdThisPeriod > 0 ? `+${overview.contests.createdThisPeriod}` : undefined,
      deltaLabel: periodLabel,
    },
    {
      key: 'revenue',
      label: 'Revenue',
      icon: IndianRupee,
      value: formatCurrency(overview.revenue.total, overview.revenue.currency),
      delta: overview.revenue.thisPeriod > 0 ? `+${formatCurrency(overview.revenue.thisPeriod, overview.revenue.currency)}` : undefined,
      deltaLabel: periodLabel,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite" aria-busy={isFetching}>
      {/* Live contests gets its own tile treatment — a status, not a trend */}
      <Card className="border-border/50 py-4">
        <CardContent className="px-4">
          <p className="text-xs font-medium text-muted-foreground">Live contests</p>
          <p className="text-2xl font-bold tracking-tight tabular-nums mt-1.5">{overview.contests.liveNow}</p>
          <div className="mt-1.5">
            {overview.contests.liveNow > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
                </span>
                Running now
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">None right now</span>
            )}
          </div>
        </CardContent>
      </Card>

      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Card key={tile.key} className="border-border/50 py-4">
            <CardContent className="px-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold tracking-tight tabular-nums mt-1.5">{tile.value}</p>
              <div className="mt-1.5 h-[18px]">
                {tile.delta && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight className="h-3 w-3" />
                    {tile.delta}
                    <span className="text-muted-foreground font-normal">{tile.deltaLabel}</span>
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
