'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Radio, ArrowRight, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';
import { useUpcomingContests } from '@/lib/hooks/useDashboard';
import { useAdminContestSocket } from '@/lib/hooks/useAdminContestSocket';
import { ContestStatusBadge, DashboardWidgetError } from './dashboard-shared';

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${String(rem).padStart(2, '0')}s`;
}

type View = 'overview' | 'integrity';

export function LiveContestCard({ orgId }: { orgId: string }) {
  const { admin } = useAuth();
  const [view, setView] = useState<View>('overview');
  const [nowTick, setNowTick] = useState(() => Date.now());

  const { data, isLoading, isError, refetch } = useUpcomingContests(orgId, {
    status: 'LIVE',
    limit: 1,
    sortBy: 'startTime',
    sortOrder: 'asc',
  });
  const contest = data?.data?.[0];

  const { connected, connectionState, stats, participants, violations } = useAdminContestSocket(
    contest?.id ?? '',
    admin?.id ?? '',
    orgId
  );

  // Tick every second while a contest is live so elapsed/remaining time feels alive.
  useEffect(() => {
    if (!contest) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [contest]);

  const scored = useMemo(() => participants.filter((p) => p.answeredCount > 0), [participants]);
  const avgScore = scored.length
    ? scored.reduce((sum, p) => sum + p.estimatedScorePercent, 0) / scored.length
    : null;
  const medScore = median(scored.map((p) => p.estimatedScorePercent));

  if (isLoading) {
    return (
      <Card className="border-border/50 h-full py-5">
        <CardContent className="px-5 space-y-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-1.5 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-border/50 h-full py-5">
        <CardContent className="px-5">
          <DashboardWidgetError message="Couldn't load your live contest." onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  if (!contest) {
    return (
      <Card className="border-border/50 h-full py-5">
        <CardContent className="px-5 h-full flex flex-col items-center justify-center gap-2 text-center">
          <Radio className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Nothing is live right now</p>
          <p className="text-xs text-muted-foreground">Check back once your next contest starts.</p>
          <Link href="/org/contests" className="text-xs text-primary hover:underline mt-1">
            View upcoming contests
          </Link>
        </CardContent>
      </Card>
    );
  }

  const startMs = new Date(contest.startTime).getTime();
  const endMs = new Date(contest.endTime).getTime();
  const durationMinutes = Math.round((endMs - startMs) / 60000);
  const durationLimitSeconds = Math.max(1, endMs - startMs) / 1000;
  const elapsedSeconds = (nowTick - startMs) / 1000;
  const remainingSeconds = (endMs - nowTick) / 1000;

  const maxParticipants = contest.maxParticipants;
  const activeCount = stats.activeNow;
  const finishedCount = stats.submitted;
  const seatsLeft = maxParticipants ? Math.max(0, maxParticipants - contest.registeredCount) : null;
  const capacityPct = maxParticipants ? Math.min(100, Math.round((contest.registeredCount / maxParticipants) * 100)) : null;
  const activePct = maxParticipants ? Math.min(100, (activeCount / maxParticipants) * 100) : 0;
  const finishedPct = maxParticipants ? Math.min(100 - activePct, (finishedCount / maxParticipants) * 100) : 0;

  const syncDot = connected ? 'bg-primary' : connectionState === 'failed' ? 'bg-destructive' : 'bg-warning';
  const syncLabel = connected
    ? 'Realtime sync active'
    : connectionState === 'failed'
      ? 'Sync failed — refresh to retry'
      : connectionState === 'slow'
        ? 'Reconnecting…'
        : 'Connecting…';

  return (
    <Card className="border-border/50 h-full py-5">
      <CardContent className="px-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive shrink-0">
              <Radio className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight truncate">{contest.title}</h3>
                <ContestStatusBadge status="LIVE" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Started {format(new Date(contest.startTime), 'h:mm a')} · {durationMinutes}m duration
              </p>
            </div>
          </div>

          <div className="inline-flex items-center rounded-lg border border-border/50 bg-secondary/30 p-0.5 shrink-0">
            <button
              onClick={() => setView('overview')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                view === 'overview' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Overview
            </button>
            <button
              onClick={() => setView('integrity')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                view === 'integrity' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Integrity ({stats.totalViolations})
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Active test takers</span>
          <span className="text-xs text-muted-foreground">Time remaining</span>
        </div>
        <div className="flex items-end justify-between mb-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight tabular-nums">{contest.registeredCount}</span>
            {maxParticipants && (
              <span className="text-sm text-muted-foreground">
                / {maxParticipants} seats ({capacityPct}%)
              </span>
            )}
          </div>
          <span className="text-xl font-bold tabular-nums text-warning">{formatClock(remainingSeconds)}</span>
        </div>

        {maxParticipants && (
          <>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex mb-2">
              <div className="h-full bg-primary" style={{ width: `${activePct}%` }} />
              <div className="h-full bg-violet-500" style={{ width: `${finishedPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="tabular-nums font-medium text-foreground">{activeCount}</span> active
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  <span className="tabular-nums font-medium text-foreground">{finishedCount}</span> finished
                </span>
              </span>
              <span className="tabular-nums">{seatsLeft} seats left</span>
            </div>
          </>
        )}

        {view === 'overview' ? (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">Average score</p>
              <p className="text-sm font-bold tabular-nums mt-1">
                {avgScore !== null ? `${avgScore.toFixed(1)}%` : '—'}
                {medScore !== null && (
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">Med: {medScore.toFixed(0)}%</span>
                )}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">Time elapsed</p>
              <p className="text-sm font-bold tabular-nums mt-1">
                {Math.floor(elapsedSeconds / 60)}m
                <span className="text-xs font-normal text-muted-foreground"> / {Math.floor(durationLimitSeconds / 60)}m limit</span>
              </p>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground tracking-wide uppercase">Integrity flags</p>
              <p className={cn('text-sm font-bold tabular-nums mt-1 flex items-center gap-1', stats.totalViolations > 0 && 'text-warning')}>
                {stats.totalViolations > 0 && <ShieldAlert className="h-3.5 w-3.5" />}
                {stats.totalViolations} {stats.totalViolations === 1 ? 'session' : 'sessions'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-4 flex-1 min-h-0">
            {violations.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">No integrity issues flagged so far.</p>
            ) : (
              <div className="space-y-1.5 max-h-[104px] overflow-y-auto pr-1">
                {violations.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                    <span className="font-medium truncate">{v.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">{v.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              {connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />}
              <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', syncDot)} />
            </span>
            {syncLabel}
          </span>
          <Link
            href={`/org/contests/${contest.id}/live`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            Open live monitor <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
