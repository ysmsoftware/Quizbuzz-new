'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  Plus,
  ArrowRight,
  LogOut,
  Settings,
  Trophy,
  DollarSign,
  PieChart,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { analyticsService } from '@/lib/services/analytics-service';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

interface DashboardData {
  dailyMetrics: any[];
  totalRegistrations: number;
  totalRevenue: number;
  avgDailyRegistrations: number;
  contestsByStatus: Record<string, number>;
  topContests: any[];
}

export default function AdminPage() {
  const router = useRouter();
  const { activeOrg, isLoggedIn } = useAuth();
  const orgId = activeOrg?.id || '';
  const { org, loading: orgLoading } = useOrganization(orgId);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load analytics data (keeping mock for now until Wave 8, but using real org ID)
    const fetchData = async () => {
      if (!orgId) return;
      
      try {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));

        const analytics = analyticsService.getOrgAnalytics(orgId, {
          from: thirtyDaysAgo.toISOString().split('T')[0],
          to: new Date().toISOString().split('T')[0],
        });

        setData(analytics as DashboardData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgId]);

  if (loading || orgLoading) {
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
          <Link href="/admin/contests/create">
            <Button size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              New Contest
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <WidgetErrorBoundary name="Global Stats Overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Contests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold">
                    {org?._count?.contests || 0}
                  </p>
                  <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    {data?.contestsByStatus.live || 0} active
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Registrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold">{data?.totalRegistrations || 0}</p>
                  <p className="text-sm text-muted-foreground">
                    Avg {data?.avgDailyRegistrations || 0} per day
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-3xl font-bold">₹{(data?.totalRevenue || 0).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">From registrations</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Contest Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Live</span>
                    <span className="font-semibold">{data?.contestsByStatus.live || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Upcoming</span>
                    <span className="font-semibold">{data?.contestsByStatus.upcoming || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ended</span>
                    <span className="font-semibold">{data?.contestsByStatus.ended || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </WidgetErrorBoundary>

        {/* Top Contests Section */}
        <WidgetErrorBoundary name="Top Contests List">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Top Contests
              </CardTitle>
              <CardDescription>Your best performing contests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.topContests && data.topContests.length > 0 ? (
                  data.topContests.map((contest) => (
                    <div key={contest.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-secondary/20 transition-colors">
                      <div className="flex-1">
                        <h3 className="font-semibold">{contest.title}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {contest.registrations} registrations
                          </span>
                          <span className="flex items-center gap-1">
                            <BarChart3 className="h-4 w-4" />
                            {contest.participationRate}% participation
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            ₹{(contest.revenue || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={contest.id === '1' ? 'default' : 'secondary'}
                        >
                          {contest.id === '1' || contest.id === '2' || contest.id === '4' ? 'Active' : 'Completed'}
                        </Badge>
                        <Link href={`/admin/contests/${contest.id}`}>
                          <Button variant="ghost" size="sm">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No contests yet. Create your first contest to get started.</p>
                    <Link href="/admin/contests/create" className="mt-4 inline-block">
                      <Button>Create Contest</Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* Quick Actions */}
        <WidgetErrorBoundary name="Quick Actions Menu">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Link href="/admin/contests/create">
                  <Button variant="outline" className="w-full justify-start h-auto py-4 flex-col items-start">
                    <Plus className="h-5 w-5 mb-2" />
                    <span className="font-semibold">Create Contest</span>
                    <span className="text-xs text-muted-foreground">Launch a new quiz</span>
                  </Button>
                </Link>

                <Link href="/admin/contests">
                  <Button variant="outline" className="w-full justify-start h-auto py-4 flex-col items-start">
                    <BookOpen className="h-5 w-5 mb-2" />
                    <span className="font-semibold">Manage Contests</span>
                    <span className="text-xs text-muted-foreground">View all contests</span>
                  </Button>
                </Link>

                <Link href="/admin/questions">
                  <Button variant="outline" className="w-full justify-start h-auto py-4 flex-col items-start">
                    <BarChart3 className="h-5 w-5 mb-2" />
                    <span className="font-semibold">Question Bank</span>
                    <span className="text-xs text-muted-foreground">Manage questions</span>
                  </Button>
                </Link>

                <Link href="/admin/analytics">
                  <Button variant="outline" className="w-full justify-start h-auto py-4 flex-col items-start">
                    <PieChart className="h-5 w-5 mb-2" />
                    <span className="font-semibold">Analytics</span>
                    <span className="text-xs text-muted-foreground">Detailed reports</span>
                  </Button>
                </Link>

                <Link href="/admin/participants">
                  <Button variant="outline" className="w-full justify-start h-auto py-4 flex-col items-start">
                    <Users className="h-5 w-5 mb-2" />
                    <span className="font-semibold">Participants</span>
                    <span className="text-xs text-muted-foreground">Manage participants</span>
                  </Button>
                </Link>

                <Link href="/admin/settings">
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
