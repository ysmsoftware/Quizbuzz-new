'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNowStrict } from 'date-fns';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpcomingContests } from '@/lib/hooks/useDashboard';
import { DashboardWidgetError } from './dashboard-shared';

const CAPACITY_THRESHOLD = 0.85;
const CLOSING_SOON_HOURS = 48;

interface Alert {
  contestId: string;
  title: string;
  detail: string;
}

export function NeedsAttentionCard({ orgId }: { orgId: string }) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useUpcomingContests(orgId, {
    limit: 10,
    sortBy: 'startTime',
    sortOrder: 'asc',
  });
  const contests = data?.data ?? [];

  if (isLoading) {
    return (
      <Card className="border-border/50 h-full py-5">
        <CardContent className="px-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-border/50 h-full py-5">
        <CardContent className="px-5 h-full flex items-center">
          <DashboardWidgetError message="Couldn't check for issues." onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  const now = Date.now();
  const alerts: Alert[] = [];

  for (const contest of contests) {
    if (contest.maxParticipants && contest.registeredCount / contest.maxParticipants >= CAPACITY_THRESHOLD) {
      alerts.push({
        contestId: contest.id,
        title: contest.title,
        detail: `${contest.registeredCount} / ${contest.maxParticipants} participants — capacity almost reached`,
      });
    }
    if (contest.status === 'PUBLISHED') {
      const deadline = new Date(contest.registrationDeadline).getTime();
      const hoursLeft = (deadline - now) / (1000 * 60 * 60);
      if (hoursLeft > 0 && hoursLeft <= CLOSING_SOON_HOURS) {
        alerts.push({
          contestId: contest.id,
          title: contest.title,
          detail: `Registration closes in ${formatDistanceToNowStrict(deadline)}`,
        });
      }
    }
  }

  const shown = alerts.slice(0, 3);

  return (
    <Card className="border-border/50 h-full py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-sm font-semibold">Needs attention</CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        {shown.length === 0 ? (
          <div className="flex items-start gap-2.5 py-2">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">You&apos;re all caught up — nothing needs attention.</p>
          </div>
        ) : (
          <div>
            {shown.map((alert, i) => (
              <button
                key={`${alert.contestId}-${i}`}
                type="button"
                onClick={() => router.push(`/org/contests/${alert.contestId}`)}
                className={`w-full text-left flex items-start gap-2.5 py-3 -mx-2 px-2 rounded-lg hover:bg-secondary/40 transition-colors ${
                  i !== shown.length - 1 ? 'border-b border-border/50' : ''
                }`}
              >
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{alert.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
