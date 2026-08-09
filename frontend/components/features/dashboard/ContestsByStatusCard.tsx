'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useContestsByStatus } from '@/lib/hooks/useDashboard';
import { CONTEST_STATUS_ORDER, DashboardWidgetError } from './dashboard-shared';

const LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Registration open',
  REGISTRATION_CLOSED: 'Registration closed',
  LIVE: 'Live',
  EVALUATION: 'Evaluating',
  RESULTS_OUT: 'Results out',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function ContestsByStatusCard({ orgId }: { orgId: string }) {
  const { data, isLoading, isError, refetch } = useContestsByStatus(orgId, false);
  const breakdown = data?.data;
  const total = breakdown ? Object.values(breakdown).reduce((a, b) => a + b, 0) : 0;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Contests by status</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : isError || !breakdown ? (
          <DashboardWidgetError message="Couldn't load the status breakdown." onRetry={() => refetch()} />
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No contests yet.</p>
        ) : (
          <div className="space-y-2.5">
            {CONTEST_STATUS_ORDER.filter((status) => breakdown[status] > 0).map((status) => {
              const count = breakdown[status];
              const pct = Math.round((count / total) * 100);
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{LABELS[status]}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
