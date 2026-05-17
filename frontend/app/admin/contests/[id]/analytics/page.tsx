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

interface AnalyticsSnapshot {
  snapshotAt: string;
  registrations: {
    total: number;
    paid: number;
    free: number;
    refunded: number;
  };
  revenue: {
    total: string;
    currency: string;
    averagePerParticipant: string;
  };
  participation: {
    totalCheckedIn: number;
    totalJoined: number;
    totalSubmitted: number;
    totalAbsent: number;
    submissionRate: number;
  };
  scores: {
    average: string;
    highest: string;
    lowest: string;
    passingCount: number;
    failingCount: number;
  };
  timing: {
    averageTimeTakenSecs: number;
    fastestTimeSecs: number;
    slowestTimeSecs: number;
  };
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

  const snapshot = snapshotData?.data as AnalyticsSnapshot | undefined;
  const distribution = scoreDistribution?.data as ScoreDistribution | undefined;

  if (isSnapshotLoading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center animate-bounce">
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
            Last snapshot: {snapshot?.snapshotAt ? format(new Date(snapshot.snapshotAt), 'MMM dd, HH:mm') : 'Never'}
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
                <p className="text-3xl font-black">{snapshot?.registrations?.total || 0}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="text-green-500 font-bold flex items-center">
                    <ArrowUpRight className="h-3 w-3" /> {snapshot?.registrations?.paid || 0}
                  </span>
                  paid entries
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden relative group hover:border-green-500/30 transition-all">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform">
                  <IndianRupee className="h-5 w-5" />
                </div>
                <Badge className="bg-green-500/10 text-green-500 border-none text-[10px] uppercase font-bold">Revenue</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-black">₹{parseFloat(snapshot?.revenue?.total || '0').toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Avg. ₹{snapshot?.revenue?.averagePerParticipant || '0'} per head</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden relative group hover:border-blue-500/30 transition-all">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                  <Activity className="h-5 w-5" />
                </div>
                <Badge className="bg-blue-500/10 text-blue-500 border-none text-[10px] uppercase font-bold">Engagement</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-black">{Math.round((snapshot?.participation?.submissionRate || 0) * 100)}%</p>
                <p className="text-xs text-muted-foreground">{snapshot?.participation?.totalSubmitted || 0} / {snapshot?.participation?.totalJoined || 0} submissions</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden relative group hover:border-amber-500/30 transition-all">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                  <Target className="h-5 w-5" />
                </div>
                <Badge className="bg-amber-500/10 text-amber-500 border-none text-[10px] uppercase font-bold">Avg. Performance</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-black">{snapshot?.scores?.average || '0.00'}</p>
                <p className="text-xs text-muted-foreground">Top score: {snapshot?.scores?.highest || '0'}</p>
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="range" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#888' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#888' }} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={40}>
                    {distribution?.buckets?.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index === distribution.buckets.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.3)'} />
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
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-semibold">Joined</span>
                    </div>
                    <span className="text-sm font-bold">{snapshot?.participation?.totalJoined}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-sm font-semibold">Submitted</span>
                    </div>
                    <span className="text-sm font-bold">{snapshot?.participation?.totalSubmitted}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-destructive" />
                      <span className="text-sm font-semibold">Absent</span>
                    </div>
                    <span className="text-sm font-bold">{snapshot?.participation?.totalAbsent}</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-border/50">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 text-center">Timing Efficiency</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-2xl bg-secondary/30 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Fastest</p>
                      <p className="text-sm font-bold">{Math.floor((snapshot?.timing?.fastestTimeSecs || 0) / 60)}m</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-secondary/30 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Slowest</p>
                      <p className="text-sm font-bold">{Math.floor((snapshot?.timing?.slowestTimeSecs || 0) / 60)}m</p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/10 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Average Duration</p>
                    <p className="text-2xl font-black text-primary">{Math.floor((snapshot?.timing?.averageTimeTakenSecs || 0) / 60)} Minutes</p>
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
                  <p className="text-xs font-bold text-primary-foreground/70 uppercase tracking-widest mb-1">Qualifying Rate</p>
                  <p className="text-4xl font-black">{Math.round(((snapshot?.scores?.passingCount || 0) / (snapshot?.participation?.totalSubmitted || 1)) * 100)}%</p>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span>Passed</span>
                    <span>{snapshot?.scores?.passingCount}</span>
                  </div>
                  <Progress 
                    value={((snapshot?.scores?.passingCount || 0) / (snapshot?.participation?.totalSubmitted || 1)) * 100} 
                    className="h-2 bg-white/20"
                    indicatorClassName="bg-white"
                  />
                  <p className="text-xs text-primary-foreground/60 italic">Based on passing cutoff defined in contest settings</p>
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
