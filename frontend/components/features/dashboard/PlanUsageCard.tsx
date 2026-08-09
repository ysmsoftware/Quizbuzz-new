'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrgUsage } from '@/lib/hooks/useOrganization';
import { PlanUsageBars } from '@/components/features/organization/PlanUsageBars';
import { DashboardWidgetError } from './dashboard-shared';

const REFETCH_MS = 10_000;

export function PlanUsageCard({ orgId }: { orgId: string }) {
  const { data, isLoading, isError, refetch } = useOrgUsage(orgId, { refetchInterval: REFETCH_MS });
  const usage = data?.data;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Plan usage</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : isError || !usage ? (
          <DashboardWidgetError message="Couldn't load plan usage." onRetry={() => refetch()} />
        ) : (
          <PlanUsageBars usage={usage} />
        )}
      </CardContent>
    </Card>
  );
}
