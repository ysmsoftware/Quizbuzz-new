'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3,
  Users,
  BookOpen,
  Plus,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { DashboardStatsCards } from '@/components/features/dashboard/DashboardStatsCards';
import { UpcomingContestsCard } from '@/components/features/dashboard/UpcomingContestsCard';
import { RegistrationTrendCard } from '@/components/features/dashboard/RegistrationTrendCard';
import { RecentRegistrationsCard } from '@/components/features/dashboard/RecentRegistrationsCard';
import { ContestsByStatusCard } from '@/components/features/dashboard/ContestsByStatusCard';
import { PlanUsageCard } from '@/components/features/dashboard/PlanUsageCard';

export default function AdminPage() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id || '';

  return (
    <div className="space-y-6">
      {/* Top Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground mt-2">Welcome back! Here&apos;s your platform overview.</p>
        </div>
        <Link href="/org/contests/create">
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            New Contest
          </Button>
        </Link>
      </div>

      {/* Stats Cards — auto-refreshes independently of the rest of the page */}
      <WidgetErrorBoundary name="Stats Overview">
        <DashboardStatsCards orgId={orgId} />
      </WidgetErrorBoundary>

      {/* Main grid: contests/trend on the left, activity feed + breakdowns on the right.
          Each card is its own error boundary + its own query, so a slow or failing
          widget never blocks the rest of the dashboard from rendering. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <WidgetErrorBoundary name="Upcoming Contests">
            <UpcomingContestsCard orgId={orgId} />
          </WidgetErrorBoundary>

          <WidgetErrorBoundary name="Registration Trend">
            <RegistrationTrendCard orgId={orgId} />
          </WidgetErrorBoundary>
        </div>

        <div className="space-y-6">
          <WidgetErrorBoundary name="Recent Registrations">
            <RecentRegistrationsCard orgId={orgId} />
          </WidgetErrorBoundary>

          <WidgetErrorBoundary name="Contests By Status">
            <ContestsByStatusCard orgId={orgId} />
          </WidgetErrorBoundary>

          <WidgetErrorBoundary name="Plan Usage">
            <PlanUsageCard orgId={orgId} />
          </WidgetErrorBoundary>
        </div>
      </div>

      {/* Quick Actions */}
      <WidgetErrorBoundary name="Quick Actions Menu">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/org/contests/create">
                <Button variant="outline" className="w-full justify-start h-auto py-4 flex-col items-start">
                  <Plus className="h-5 w-5 mb-2" />
                  <span className="font-semibold">Create Contest</span>
                  <span className="text-xs text-muted-foreground">Launch a new quiz</span>
                </Button>
              </Link>

              <Link href="/org/contests">
                <Button variant="outline" className="w-full justify-start h-auto py-4 flex-col items-start">
                  <BookOpen className="h-5 w-5 mb-2" />
                  <span className="font-semibold">Manage Contests</span>
                  <span className="text-xs text-muted-foreground">View all contests</span>
                </Button>
              </Link>

              <Link href="/org/questions">
                <Button variant="outline" className="w-full justify-start h-auto py-4 flex-col items-start">
                  <BarChart3 className="h-5 w-5 mb-2" />
                  <span className="font-semibold">Question Bank</span>
                  <span className="text-xs text-muted-foreground">Manage questions</span>
                </Button>
              </Link>

              <Link href="/org/participants">
                <Button variant="outline" className="w-full justify-start h-auto py-4 flex-col items-start">
                  <Users className="h-5 w-5 mb-2" />
                  <span className="font-semibold">Participants</span>
                  <span className="text-xs text-muted-foreground">Manage participants</span>
                </Button>
              </Link>

              <Link href="/org/settings">
                <Button variant="outline" className="w-full justify-start h-auto py-4 flex-col items-start">
                  <Settings className="h-5 w-5 mb-2" />
                  <span className="font-semibold">Settings</span>
                  <span className="text-xs text-muted-foreground">Configure platform</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </WidgetErrorBoundary>
    </div>
  );
}
