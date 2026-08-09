'use client';

import { Trophy, Radio, Users, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardOverview } from '@/lib/hooks/useDashboard';
import { DashboardWidgetError, formatCurrency } from './dashboard-shared';

interface StatDef {
  key: string;
  label: string;
  icon: typeof Trophy;
  value: string;
  delta?: string;
}

export function DashboardStatsCards({ orgId }: { orgId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useDashboardOverview(orgId, 'month');
  const overview = data?.data;

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-28" />
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

  const stats: StatDef[] = [
    {
      key: 'contests',
      label: 'Total contests',
      icon: Trophy,
      value: String(overview.contests.total),
      delta: overview.contests.createdThisPeriod > 0 ? `+${overview.contests.createdThisPeriod} this month` : undefined,
    },
    {
      key: 'live',
      label: 'Live now',
      icon: Radio,
      value: String(overview.contests.liveNow),
    },
    {
      key: 'registrations',
      label: 'Registrations',
      icon: Users,
      value: String(overview.registrations.total),
      delta: overview.registrations.newThisPeriod > 0 ? `+${overview.registrations.newThisPeriod} this month` : undefined,
    },
    {
      key: 'revenue',
      label: 'Revenue',
      icon: IndianRupee,
      value: formatCurrency(overview.revenue.total, overview.revenue.currency),
      delta: overview.revenue.thisPeriod > 0
        ? `+${formatCurrency(overview.revenue.thisPeriod, overview.revenue.currency)} this month`
        : undefined,
    },
  ];

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-live="polite"
      aria-busy={isFetching}
    >
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.key} className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{stat.value}</p>
                {stat.delta ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{stat.delta}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">&nbsp;</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
