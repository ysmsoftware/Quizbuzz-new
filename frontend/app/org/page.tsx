'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { DashboardStatsCards } from '@/components/features/dashboard/DashboardStatsCards';
import { LiveContestCard } from '@/components/features/dashboard/LiveContestCard';
import { TodaysPulseCard } from '@/components/features/dashboard/TodaysPulseCard';
import { UpcomingContestsCard } from '@/components/features/dashboard/UpcomingContestsCard';
import { QuickActionsCard } from '@/components/features/dashboard/QuickActionsCard';
import { RegistrationTrendCard } from '@/components/features/dashboard/RegistrationTrendCard';
import { NeedsAttentionCard } from '@/components/features/dashboard/NeedsAttentionCard';

export default function AdminPage() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id || '';
  const [period, setPeriod] = useState<'week' | 'month'>('month');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Live contests, registrations and this {period}&apos;s activity at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center rounded-lg border border-border/50 bg-secondary/40 p-0.5">
            {(['week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors',
                  period === p ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <Link href="/org/contests/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New contest
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats — auto-refreshes independently of the rest of the page */}
      <WidgetErrorBoundary name="Stats Overview">
        <DashboardStatsCards orgId={orgId} period={period} />
      </WidgetErrorBoundary>

      {/* Live contest (hero) + today's registration pulse.
          Each card is its own error boundary + its own query, so a slow or
          failing widget never blocks the rest of the dashboard from rendering. */}
      <div className="grid gap-4 lg:grid-cols-5 items-stretch">
        <div className="lg:col-span-3">
          <WidgetErrorBoundary name="Live Contest">
            <LiveContestCard orgId={orgId} />
          </WidgetErrorBoundary>
        </div>
        <div className="lg:col-span-2">
          <WidgetErrorBoundary name="Today's Pulse">
            <TodaysPulseCard orgId={orgId} />
          </WidgetErrorBoundary>
        </div>
      </div>

      {/* Upcoming contests + quick actions */}
      <div className="grid gap-4 lg:grid-cols-5 items-stretch">
        <div className="lg:col-span-3">
          <WidgetErrorBoundary name="Upcoming Contests">
            <UpcomingContestsCard orgId={orgId} orgName={activeOrg?.name} />
          </WidgetErrorBoundary>
        </div>
        <div className="lg:col-span-2">
          <WidgetErrorBoundary name="Quick Actions">
            <QuickActionsCard />
          </WidgetErrorBoundary>
        </div>
      </div>

      {/* Registration trend + things that need a look */}
      <div className="grid gap-4 lg:grid-cols-5 items-stretch">
        <div className="lg:col-span-3">
          <WidgetErrorBoundary name="Registration Trend">
            <RegistrationTrendCard orgId={orgId} />
          </WidgetErrorBoundary>
        </div>
        <div className="lg:col-span-2">
          <WidgetErrorBoundary name="Needs Attention">
            <NeedsAttentionCard orgId={orgId} />
          </WidgetErrorBoundary>
        </div>
      </div>
    </div>
  );
}
