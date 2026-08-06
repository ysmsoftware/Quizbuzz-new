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
import { useOrganization } from '@/lib/hooks/useOrganization';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function AdminPage() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id || '';
  const { org, loading: orgLoading } = useOrganization(orgId);
  const orgData = org as any;

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

        {/* Stats Cards */}
        <WidgetErrorBoundary name="Global Stats Overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Contests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold">
                    {orgData?._count?.contests || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Registered in organization</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Organization Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold capitalize">{orgData?.status || 'Active'}</p>
                  <p className="text-sm text-muted-foreground">{orgData?.name || 'Organization'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </WidgetErrorBoundary>

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
