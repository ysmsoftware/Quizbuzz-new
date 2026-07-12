'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  IndianRupee, 
  Clock, 
  Target, 
  Zap, 
  RefreshCcw,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  PieChart,
  Calendar,
  LayoutDashboard
} from 'lucide-react';
import { analyticsApi } from '@/lib/api/post-quiz.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Flat shape matching backend's ContestAnalyticsSnapshot Prisma model
interface AnalyticsSnapshot {
  snapshotAt: string;
  // Registration
  totalRegistrations: number;
  totalRevenue: number | string;
  // Participation
  totalParticipated: number;
  totalSubmitted: number;
  // Scores
  avgScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  medianScore: number | null;
  avgTimeTakenSecs: number | null;
  fastestTimeSecs?: number | null;
  slowestTimeSecs?: number | null;
  passingCount?: number | null;
  failingCount?: number | null;
  // Live (from Redis supplement)
  activeNow?: number;
}

interface ScoreDistribution {
  buckets: Array<{ range: string; count: number }>;
  totalEvaluated: number;
  cutoffScore: number;
  passCount: number;
  failCount: number;
}


import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function ContestAnalyticsPage() {
  const { id: contestId } = useParams() as { id: string };

  // Queries
  const { data: snapshotData, isLoading: isSnapshotLoading, refetch: refetchSnapshot } = useQuery({
    queryKey: ['analytics', contestId],
    queryFn: () => analyticsApi.getContestAnalytics(contestId),
  });

  const { data: scoreDistribution } = useQuery({
    queryKey: ['score-distribution', contestId],
    queryFn: () => analyticsApi.getScoreDistribution(contestId),
  });

  const refreshMutation = useMutation({
    mutationFn: () => analyticsApi.refreshAnalytics(contestId),
    onSuccess: () => {
      toast.success('Analytics refresh queued. Re-fetching in 3 seconds...');
      setTimeout(() => refetchSnapshot(), 3000);
    },
  });

  // Backend returns: { snapshot: AnalyticsSnapshot | null, live: LiveAnalytics }
  // The page only renders snapshot data; live data supplements when snapshot is null.
  const rawData = snapshotData?.data;
  const snapshotRaw = (rawData?.snapshot ?? null) as AnalyticsSnapshot | null;
  const liveData = rawData?.live as { activeNow: number; totalParticipated: number; totalSubmitted: number } | undefined;

  // Merge live data into snapshot for real-time feel when a snapshot exists,
  // or build a minimal display object from live data when no snapshot has been computed yet.
  const snapshot: AnalyticsSnapshot | null = snapshotRaw
    ? {
        ...snapshotRaw,
        totalParticipated: liveData?.totalParticipated ?? snapshotRaw.totalParticipated,
        totalSubmitted: liveData?.totalSubmitted ?? snapshotRaw.totalSubmitted,
        activeNow: liveData?.activeNow,
      }
    : liveData
    ? {
        snapshotAt: new Date().toISOString(),
        totalRegistrations: 0,
        totalRevenue: 0,
        totalParticipated: liveData.totalParticipated,
        totalSubmitted: liveData.totalSubmitted,
        avgScore: null,
        highestScore: null,
        lowestScore: null,
        medianScore: null,
        avgTimeTakenSecs: null,
        activeNow: liveData.activeNow,
      }
    : null;

  const distribution = scoreDistribution?.data as ScoreDistribution | undefined;

  if (isSnapshotLoading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground font-medium">Computing analytics snapshot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Contest Analytics</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Last snapshot: {snapshotRaw?.snapshotAt ? format(new Date(snapshotRaw.snapshotAt), 'MMM dd, HH:mm') : 'Never'}
            <span className="h-1 w-1 rounded-full bg-border" />
            Automatically updates every 15 minutes
          </p>
        </div>
        <Button 
          variant="outline" 
          className="rounded-xl h-11 px-6 border-border/50 hover:bg-secondary/50 group"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          <RefreshCcw className={cn("h-4 w-4 mr-2", refreshMutation.isPending && "animate-spin")} />
          Refresh Snapshot
        </Button>
      </div>

      {/* No-snapshot banner */}
      {!snapshotRaw && (
        <div className="flex items-start gap-4 p-5 rounded-2xl bg-warning/10 border border-warning/20">
          <div className="h-9 w-9 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
            <LayoutDashboard className="h-4 w-4 text-warning" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-warning mb-0.5">No snapshot generated yet</p>
            <p className="text-xs text-muted-foreground">
              Analytics snapshots are computed periodically. Click{' '}
              <button
                onClick={() => refreshMutation.mutate()}
                className="font-bold text-primary hover:underline"
              >
                Refresh Snapshot
              </button>{' '}
              to generate one now. Live participation counts are shown below from real-time data.
            </p>
          </div>
        </div>
      )}

      {/* High Level Metrics */}
      <WidgetErrorBoundary name="Analytics Metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden relative group hover:border-primary/30 transition-all">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Users className="h-5 w-5" />
                </div>
                <Badge className="bg-primary/10 text-primary border-none text-[10px] uppercase font-bold">Registration</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-black">{snapshot?.totalRegistrations ?? 0}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="text-success font-bold flex items-center">
                    <ArrowUpRight className="h-3 w-3" /> {snapshot?.totalSubmitted ?? 0}
                  </span>
                  paid entries
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden relative group hover:border-success/30 transition-all">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center text-success group-hover:scale-110 transition-transform">
                  <IndianRupee className="h-5 w-5" />
                </div>
                <Badge className="bg-success/10 text-success border-none text-[10px] uppercase font-bold">Revenue</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-black">₹{Number(snapshot?.totalRevenue ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Avg. ₹{snapshot?.totalRegistrations ? Math.round(Number(snapshot?.totalRevenue ?? 0) / snapshot.totalRegistrations) : 0} per head</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden relative group hover:border-chart-2/30 transition-all">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 rounded-xl bg-chart-2/10 flex items-center justify-center text-chart-2 group-hover:scale-110 transition-transform">
                  <Activity className="h-5 w-5" />
                </div>
                <Badge className="bg-chart-2/10 text-chart-2 border-none text-[10px] uppercase font-bold">Engagement</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-black">
                  {snapshot?.totalParticipated && snapshot?.totalRegistrations
                    ? Math.round((snapshot.totalSubmitted / snapshot.totalParticipated) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">{snapshot?.totalSubmitted ?? 0} / {snapshot?.totalParticipated ?? 0} submissions</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden relative group hover:border-warning/30 transition-all">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning group-hover:scale-110 transition-transform">
                  <Target className="h-5 w-5" />
                </div>
                <Badge className="bg-warning/10 text-warning border-none text-[10px] uppercase font-bold">Avg. Performance</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-black">{snapshot?.avgScore != null ? Number(snapshot.avgScore).toFixed(2) : '—'}</p>
                <p className="text-xs text-muted-foreground">Top score: {snapshot?.highestScore ?? '—'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </WidgetErrorBoundary>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Score Distribution Histogram */}
        <WidgetErrorBoundary name="Score Distribution Chart">
          <Card className="lg:col-span-2 bg-background/50 border-border/50 rounded-3xl overflow-hidden shadow-sm">
            <CardHeader className="p-8 pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    Score Distribution
                  </CardTitle>
                  <CardDescription>Histogram of participant performance across score buckets</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 mr-4">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Participants</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-0 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution?.buckets || []} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="range"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--muted-foreground)' }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)' }}
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid var(--border)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: 'var(--popover)',
                      color: 'var(--popover-foreground)',
                    }}
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} barSize={40}>
                    {distribution?.buckets?.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index === distribution.buckets.length - 1 ? 'var(--primary)' : 'color-mix(in oklch, var(--primary) 30%, transparent)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* Detailed Stats Column */}
        <div className="space-y-6">
          {/* Participation Mix */}
          <WidgetErrorBoundary name="Participation Details">
            <Card className="bg-background/50 border-border/50 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="p-6 pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Participation Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-success" />
                      <span className="text-sm font-semibold">Joined</span>
                    </div>
                    <span className="text-sm font-bold">{snapshot?.totalParticipated ?? '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-sm font-semibold">Submitted</span>
                    </div>
                    <span className="text-sm font-bold">{snapshot?.totalSubmitted ?? '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-destructive" />
                      <span className="text-sm font-semibold">Absent</span>
                    </div>
                    <span className="text-sm font-bold">
                      {snapshot?.totalRegistrations != null && snapshot?.totalParticipated != null
                        ? snapshot.totalRegistrations - snapshot.totalParticipated
                        : '—'}
                    </span>
                  </div>
                </div>
                <div className="pt-4 border-t border-border/50">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 text-center">Timing Efficiency</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-2xl bg-secondary/30 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Fastest</p>
                      <p className="text-sm font-bold">{Math.floor((snapshot?.fastestTimeSecs ?? 0) / 60)}m</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-secondary/30 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Slowest</p>
                      <p className="text-sm font-bold">{Math.floor((snapshot?.slowestTimeSecs ?? 0) / 60)}m</p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/10 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Average Duration</p>
                    <p className="text-2xl font-black text-primary">{Math.floor((snapshot?.avgTimeTakenSecs ?? 0) / 60)} Minutes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </WidgetErrorBoundary>

          {/* Pass/Fail Ratio */}
          <WidgetErrorBoundary name="Pass Fail Ratio">
            <Card className="bg-primary border-none rounded-3xl overflow-hidden shadow-lg shadow-primary/20 text-primary-foreground relative">
              <div className="absolute top-0 right-0 p-6 opacity-20">
                <Trophy className="h-16 w-16" />
              </div>
              <CardContent className="p-8 relative z-10 space-y-6">
                <div>
                  <p className="text-xs font-bold text-primary-foreground uppercase tracking-widest mb-1">Qualifying Rate</p>
                  <p className="text-4xl font-black">
                    {snapshot?.passingCount != null && snapshot?.totalSubmitted && snapshot.totalSubmitted > 0
                      ? Math.round((Number(snapshot.passingCount) / snapshot.totalSubmitted) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span>Passed</span>
                    <span>{snapshot?.passingCount ?? 0}</span>
                  </div>
                    <Progress 
                      value={snapshot?.totalSubmitted && snapshot?.totalRegistrations
                        ? (snapshot.totalSubmitted / snapshot.totalRegistrations) * 100
                        : 0}
                      className="h-2 bg-white/20"
                      indicatorClassName="bg-white"
                    />
                  <p className="text-xs text-primary-foreground/90 italic">Based on passing cutoff defined in contest settings</p>
                </div>
              </CardContent>
            </Card>
          </WidgetErrorBoundary>
        </div>
      </div>
    </div>
  );
}

function Trophy({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
