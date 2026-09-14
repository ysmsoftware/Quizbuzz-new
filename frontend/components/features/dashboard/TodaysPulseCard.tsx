'use client';

import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { ArrowRight, ArrowUpRight, ArrowDownRight, Zap, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRegistrationTrend, useRecentRegistrations } from '@/lib/hooks/useDashboard';
import { DashboardWidgetError } from './dashboard-shared';

/** Catmull-Rom → cubic-bezier through every real point — smooth, but never invents a value. */
function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 === points.length ? i + 1 : i + 2];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Tiny inline sparkline — not worth pulling in recharts for a 7-point line. */
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 200;
  const h = 48;
  const pad = 4;
  const step = (w - pad * 2) / (values.length - 1 || 1);
  const points: [number, number][] = values.map((v, i) => [
    pad + i * step,
    pad + (h - pad * 2) * (1 - (v - min) / range),
  ]);
  const line = smoothPath(points);
  const [lastX] = points[points.length - 1];
  const area = `${line} L ${lastX.toFixed(1)},${h} L ${points[0][0].toFixed(1)},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pulse-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pulse-fill)" stroke="none" />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TodaysPulseCard({ orgId }: { orgId: string }) {
  const { data, isLoading, isError, refetch } = useRegistrationTrend(orgId, 7);
  const points = data?.data ?? [];
  const { data: recentData } = useRecentRegistrations(orgId, { limit: 1, sortBy: 'createdAt', sortOrder: 'desc' });
  const latest = recentData?.data.data[0];

  if (isLoading) {
    return (
      <Card className="border-border/50 h-full py-5">
        <CardContent className="px-5 space-y-3">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || points.length === 0) {
    return (
      <Card className="border-border/50 h-full py-5">
        <CardContent className="px-5 h-full flex items-center">
          <DashboardWidgetError message="Couldn't load today's activity." onRetry={() => refetch()} />
        </CardContent>
      </Card>
    );
  }

  const today = points[points.length - 1];
  const yesterday = points.length > 1 ? points[points.length - 2] : null;
  const delta = yesterday ? today.count - yesterday.count : null;
  const deltaPct = yesterday && yesterday.count > 0 ? Math.round((delta! / yesterday.count) * 100) : null;

  return (
    <Card className="border-border/50 h-full py-5">
      <CardContent className="px-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            Today&apos;s pulse
          </p>
          <Link href="/org/participants" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <p className="text-xs text-muted-foreground mb-1">Registrations</p>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold tracking-tight tabular-nums">{today.count}</span>
          {delta !== null && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
              }`}
            >
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {deltaPct !== null ? `${deltaPct > 0 ? '+' : ''}${deltaPct}%` : delta}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">vs. yesterday</p>

        <div className="mt-auto">
          <Sparkline values={points.map((p) => p.count)} />
        </div>

        {latest && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Latest registration
              </span>
              <span className="text-foreground font-medium">
                {latest.contact.firstName} {latest.contact.lastName ?? ''}
                <span className="text-muted-foreground font-normal">
                  {' '}
                  ({formatDistanceToNowStrict(new Date(latest.createdAt), { addSuffix: true })})
                </span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-right truncate">{latest.contest.title}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
