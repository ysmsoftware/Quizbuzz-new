'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronRight, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpcomingContests } from '@/lib/hooks/useDashboard';
import { ContestStatusBadge, DashboardWidgetError } from './dashboard-shared';

export function UpcomingContestsCard({ orgId }: { orgId: string }) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useUpcomingContests(orgId, {
    limit: 5,
    sortBy: 'startTime',
    sortOrder: 'asc',
  });
  const contests = data?.data ?? [];

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Upcoming contests</CardTitle>
        <Link href="/org/contests" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-border/50 rounded-lg p-3 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <DashboardWidgetError message="Couldn't load upcoming contests." onRetry={() => refetch()} />
        ) : contests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Trophy className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No upcoming contests scheduled.</p>
            <Link href="/org/contests/create" className="text-xs text-primary hover:underline">
              Create a contest
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {contests.map((contest) => {
              const capacityPct = contest.maxParticipants
                ? Math.min(100, Math.round((contest.registeredCount / contest.maxParticipants) * 100))
                : null;

              return (
                <button
                  key={contest.id}
                  type="button"
                  onClick={() => router.push(`/org/contests/${contest.id}`)}
                  className="w-full text-left border border-border/50 rounded-lg p-3 hover:bg-secondary/40 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{contest.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ContestStatusBadge status={contest.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Starts {format(new Date(contest.startTime), "MMM d, h:mm a")}
                  </p>
                  {capacityPct !== null && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${capacityPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {contest.registeredCount} / {contest.maxParticipants}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
