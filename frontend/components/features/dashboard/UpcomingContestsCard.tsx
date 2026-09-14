'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowUpRight, Calendar, Trophy, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useUpcomingContests } from '@/lib/hooks/useDashboard';
import { DashboardWidgetError } from './dashboard-shared';
import type { ContestStatus } from '@/lib/api/dashboard.api';

const CLOSING_SOON_HOURS = 48;

type Filter = 'all' | 'open' | 'closing' | 'draft';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'closing', label: 'Closing Soon' },
  { key: 'draft', label: 'Draft' },
];

function statusPill(status: ContestStatus, closingSoon: boolean) {
  if (closingSoon) {
    return { label: 'Closing soon', dot: 'bg-warning', className: 'bg-warning/10 text-warning' };
  }
  switch (status) {
    case 'PUBLISHED':
      return { label: 'Open', dot: 'bg-primary', className: 'bg-primary/10 text-primary' };
    case 'DRAFT':
      return { label: 'Draft', dot: 'bg-muted-foreground', className: 'bg-muted text-muted-foreground' };
    case 'REGISTRATION_CLOSED':
      return { label: 'Registration closed', dot: 'bg-muted-foreground', className: 'bg-muted text-muted-foreground' };
    default:
      return { label: status, dot: 'bg-muted-foreground', className: 'bg-muted text-muted-foreground' };
  }
}

export function UpcomingContestsCard({ orgId, orgName }: { orgId: string; orgName?: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading, isError, refetch } = useUpcomingContests(orgId, {
    limit: 8,
    sortBy: 'startTime',
    sortOrder: 'asc',
  });

  // The currently live contest gets its own hero card elsewhere on the dashboard.
  const allContests = useMemo(() => (data?.data ?? []).filter((c) => c.status !== 'LIVE'), [data]);

  const now = Date.now();
  const withMeta = useMemo(
    () =>
      allContests.map((contest) => {
        const hoursToDeadline = (new Date(contest.registrationDeadline).getTime() - now) / (1000 * 60 * 60);
        const closingSoon = contest.status === 'PUBLISHED' && hoursToDeadline > 0 && hoursToDeadline <= CLOSING_SOON_HOURS;
        const durationMinutes = Math.round(
          (new Date(contest.endTime).getTime() - new Date(contest.startTime).getTime()) / 60000
        );
        return { contest, closingSoon, durationMinutes };
      }),
    [allContests, now]
  );

  const filtered = withMeta.filter(({ contest, closingSoon }) => {
    if (filter === 'open') return contest.status === 'PUBLISHED' && !closingSoon;
    if (filter === 'closing') return closingSoon;
    if (filter === 'draft') return contest.status === 'DRAFT';
    return true;
  });

  const openPortals = withMeta.filter((c) => c.contest.status === 'PUBLISHED').length;
  const slotsRemaining = withMeta.reduce((sum, { contest }) => {
    if (!contest.maxParticipants) return sum;
    return sum + Math.max(0, contest.maxParticipants - contest.registeredCount);
  }, 0);

  return (
    <Card className="border-border/50 h-full py-5">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 px-5">
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            Upcoming contests
          </CardTitle>
          <div className="inline-flex items-center rounded-lg border border-border/50 bg-secondary/30 p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
                  filter === f.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <Link href="/org/contests" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0">
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="px-5">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <DashboardWidgetError message="Couldn't load upcoming contests." onRetry={() => refetch()} />
        ) : allContests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Trophy className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No upcoming contests scheduled.</p>
            <Link href="/org/contests/create" className="text-xs text-primary hover:underline">
              Create a contest
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No contests match this filter.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(({ contest, closingSoon, durationMinutes }) => {
              const capacityPct = contest.maxParticipants
                ? Math.min(100, Math.round((contest.registeredCount / contest.maxParticipants) * 100))
                : null;
              const pill = statusPill(contest.status, closingSoon);

              return (
                <button
                  key={contest.id}
                  type="button"
                  onClick={() => router.push(`/org/contests/${contest.id}`)}
                  className="w-full text-left border border-border/50 rounded-xl p-4 hover:bg-secondary/30 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{contest.title}</span>
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full', pill.className)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', pill.dot)} />
                          {pill.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(new Date(contest.startTime), 'MMM d, h:mm a')}</span>
                        <span>·</span>
                        <span>{durationMinutes}m duration</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right min-w-[120px]">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {contest.maxParticipants ? `${contest.registeredCount} / ${contest.maxParticipants}` : contest.registeredCount}
                      </span>
                      {capacityPct !== null && (
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
                          <div
                            className={cn('h-full rounded-full transition-all', closingSoon ? 'bg-warning' : 'bg-primary')}
                            style={{ width: `${capacityPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {allContests.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-4 pt-4 border-t border-border/50">
            <span>
              {openPortals} active registration {openPortals === 1 ? 'portal' : 'portals'} open{orgName ? ` for ${orgName}` : ''}
            </span>
            <span className="tabular-nums">Slots remaining: {slotsRemaining.toLocaleString('en-IN')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
