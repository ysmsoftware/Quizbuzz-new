'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Trophy, 
  Download, 
  RefreshCcw, 
  CheckCircle2, 
  Send,
  Zap,
  Medal,
  Crown,
  BarChart3,
  ChevronLeft,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Eye,
  Activity
} from 'lucide-react';
import { resultsApi, LeaderboardEntry } from '@/lib/api/results-certs.api';
import { getContest } from '@/lib/api/contests.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LeaderboardPodium } from '@/components/features/leaderboard/LeaderboardPodium';
import { ScoreDistributionChart } from '@/components/features/leaderboard/ScoreDistributionChart';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function AdminResultsPage() {
  const { id: contestId } = useParams() as { id: string };
  const queryClient = useQueryClient();
  const router = useRouter();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Queries
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['admin-leaderboard', contestId, { page }],
    queryFn: () => resultsApi.getAdminLeaderboard(contestId, { page, limit: 50 }),
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });

  const { data: contestData } = useQuery({
    queryKey: ['contests', contestId],
    queryFn: () => getContest(contestId),
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });
  const contest = contestData?.data;

  const { data: scoreDistribution } = useQuery({
    queryKey: ['score-distribution', contestId],
    queryFn: () => resultsApi.getScoreDistribution(contestId),
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });

  // Mutations
  // Rebuild leaderboard maps to the evaluate endpoint (re-runs scoring pipeline)
  const rebuildMutation = useMutation({
    mutationFn: () => resultsApi.triggerEvaluate(contestId),
    onSuccess: () => {
      toast.success('Re-evaluation queued — rankings will update shortly');
      queryClient.invalidateQueries({ queryKey: ['admin-leaderboard', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to queue re-evaluation');
    },
  });

  // Declare results: makes leaderboard public to participants
  // Per product design: this should only be used for manual override.
  // Normally results auto-publish after showResultsAfter hours via BullMQ.
  const declareResultsMutation = useMutation({
    mutationFn: () => resultsApi.declareResults(contestId),
    onSuccess: () => {
      toast.success('Results declared — public leaderboard is now live.');
      queryClient.invalidateQueries({ queryKey: ['admin-leaderboard', contestId] });
      queryClient.invalidateQueries({ queryKey: ['contests', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to declare results');
    },
  });

  const entries = leaderboardData?.data?.entries || (leaderboardData as any)?.entries || [];
  const pagination = leaderboardData?.data?.pagination || (leaderboardData as any)?.pagination;
  const totalEntries = leaderboardData?.data?.totalEntries || (leaderboardData as any)?.totalEntries || pagination?.total || 0;

  const handleExportCSV = () => {
    toast.info('Exporting results as CSV...');
    // Logic for CSV export would go here
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Results & Leaderboard</h1>
          <p className="text-muted-foreground">Manage final rankings and publish official results to participants.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl h-11" 
            onClick={() => rebuildMutation.mutate()}
            disabled={rebuildMutation.isPending}
          >
            <RefreshCcw className={cn("h-4 w-4 mr-2", rebuildMutation.isPending && "animate-spin")} />
            Rebuild Leaderboard
          </Button>
          <Button 
            className="rounded-xl h-11 bg-primary shadow-lg shadow-primary/20"
            onClick={() => declareResultsMutation.mutate()}
            disabled={declareResultsMutation.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            Declare Results
          </Button>
        </div>
      </div>

      {/* Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Podium Preview */}
          <Card className="bg-background/50 border-border/50 rounded-3xl overflow-hidden shadow-sm">
            <CardHeader className="p-8 pb-0">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Current Standings Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-6">
              <WidgetErrorBoundary name="Leaderboard Podium">
                {entries.length > 0 ? (
                  <LeaderboardPodium topThree={entries.slice(0, 3)} />
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground italic border-2 border-dashed border-border/50 rounded-2xl">
                    No rankings generated yet. Click 'Rebuild Leaderboard' to start.
                  </div>
                )}
              </WidgetErrorBoundary>
            </CardContent>
          </Card>

          {/* Leaderboard Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Detailed Rankings</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search ranking..." 
                  className="pl-10 h-10 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <Card className="bg-background/50 border-border/50 rounded-2xl overflow-hidden shadow-sm">
              <WidgetErrorBoundary name="Rankings Table">
                <Table>
                  <TableHeader className="bg-secondary/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold w-20">Rank</TableHead>
                      <TableHead className="font-bold">Participant</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                      <TableHead className="font-bold text-center">Score</TableHead>
                      <TableHead className="font-bold text-center">Percentage</TableHead>
                      <TableHead className="font-bold text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="animate-pulse">
                          <TableCell colSpan={6} className="h-16 bg-secondary/10" />
                        </TableRow>
                      ))
                    ) : entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                          Leaderboard is empty. Evaluation might be in progress.
                        </TableCell>
                      </TableRow>
                    ) : (
                      entries.map((entry: any) => (
                        <TableRow key={entry.participant?.registrationRef || entry.id} className="hover:bg-secondary/20 transition-colors group">
                          <TableCell className="font-black text-primary">#{entry.rank}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-bold text-sm">
                                {entry.participant?.contact ? `${entry.participant.contact.firstName || ''} ${entry.participant.contact.lastName || ''}`.trim() : 'Unknown Participant'}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {entry.participant?.registrationRef || 'No Ref'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {entry.isPassed ? (
                              <Badge className="bg-green-500/10 text-green-500 border-none hover:bg-green-500/20">PASSED</Badge>
                            ) : (
                              <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-none hover:bg-red-500/20">FAILED</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-bold">{entry.score}</TableCell>
                          <TableCell className="text-center font-bold text-green-500">{entry.percentage}%</TableCell>
                          <TableCell className="text-right pr-6">
                            {entry.id && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:text-primary"
                                onClick={() => router.push(`/admin/contests/${contestId}/submissions/${entry.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </WidgetErrorBoundary>
            </Card>
          </div>
        </div>

        <div className="space-y-8">
          {/* Actions & Status */}
          <Card className="bg-primary border-none rounded-[2rem] overflow-hidden shadow-xl shadow-primary/20 text-primary-foreground">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Badge className="bg-white/20 text-white border-none text-[10px] uppercase font-black tracking-widest">Publishing Status</Badge>
                <h3 className="text-2xl font-black">Private Mode</h3>
                <p className="text-primary-foreground/70 text-sm leading-relaxed">
                  Results are currently only visible to admins. Use 'Declare Results' to make them public to participants.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10 space-y-3">
                <Button className="w-full bg-white text-primary hover:bg-white/90 rounded-xl h-12 font-bold" onClick={() => declareResultsMutation.mutate()}>
                  Declare Official Results
                </Button>
                <Button variant="ghost" className="w-full text-white hover:bg-white/10 rounded-xl h-12 font-medium" onClick={() => {
                  if (contest?.slug) router.push(`/quiz/${contest.slug}/leaderboard`);
                }}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Preview Public View
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Performance Spread */}
          {scoreDistribution?.data && (
            <Card className="bg-background/50 border-border/50 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="p-8 pb-0">
                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Performance Spread
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 pt-6">
                <WidgetErrorBoundary name="Score Distribution Chart">
                  <ScoreDistributionChart data={scoreDistribution.data.buckets.reduce((acc: any, b: any) => ({ ...acc, [b.range]: b.count }), {})} />
                </WidgetErrorBoundary>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 gap-4">
            <Card className="bg-secondary/20 border-border/50 rounded-2xl p-6 flex items-center justify-between group hover:border-primary/30 transition-all">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Ranked</p>
                <p className="text-2xl font-black">{totalEntries}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Activity className="h-5 w-5" />
              </div>
            </Card>

            <Card className="bg-secondary/20 border-border/50 rounded-2xl p-6 flex items-center justify-between group hover:border-amber-500/30 transition-all">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Top Accuracy</p>
                <p className="text-2xl font-black">{entries[0]?.percentage || 0}%</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <TargetIcon className="h-5 w-5" />
              </div>
            </Card>
          </div>

          {/* Export Options */}
          <Card className="bg-background/50 border-border/50 rounded-3xl p-6">
            <CardTitle className="text-sm font-bold uppercase tracking-widest mb-6">Report Center</CardTitle>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start rounded-xl h-12 border-border/50 hover:bg-secondary/50 group" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                Export CSV Report
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-xl h-12 border-border/50 hover:bg-secondary/50 group">
                <Download className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                Download Prize List
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TargetIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
