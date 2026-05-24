'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShieldAlert, 
  AlertTriangle, 
  ShieldCheck, 
  Users, 
  Search, 
  Filter, 
  MoreVertical,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Activity,
  UserCheck,
  Ban
} from 'lucide-react';
import { proctoringApi } from '@/lib/api/post-quiz.api';
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ProctoringOverview {
  totalParticipants: number;
  flaggedCount: number;
  disqualifiedCount: number;
  cleanCount: number;
  averageTrustScore: number;
  totalViolations: number;
  byType: Record<string, number>;
}

interface FlaggedParticipant {
  participantId: string;
  totalViolations: number;
  highSeverityCount: number;
  violationScore: number;
  trustScore: number;
  isFlagged: boolean;
  flaggedAt: string;
  participant: {
    status: string;
    contact: {
      firstName: string;
      lastName: string;
      email: string;
    }
  }
}


import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function ProctoringControlPanel() {
  const { id: contestId } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Queries
  const { data: overviewData, isLoading: isOverviewLoading } = useQuery({
    queryKey: ['proctoring-overview', contestId],
    queryFn: () => proctoringApi.getOverview(contestId),
  });

  const { data: flaggedData, isLoading: isFlaggedLoading } = useQuery({
    queryKey: ['proctoring-flagged', contestId, { page }],
    queryFn: () => proctoringApi.getFlaggedParticipants(contestId, { page, limit: 20 }),
  });

  const overview = overviewData?.data as ProctoringOverview | undefined;
  const flaggedParticipants = (flaggedData?.data?.data || []) as FlaggedParticipant[];
  const pagination = flaggedData?.data?.pagination;


  const getTrustScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500 bg-green-500/10 border-green-500/20';
    if (score >= 70) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-destructive bg-destructive/10 border-destructive/20';
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Proctoring Control</h1>
          <p className="text-muted-foreground">
            Post-contest review and flagged-participant management. For live violations,
            waiting-room counts, and in-quiz progress, use{' '}
            <button
              type="button"
              className="text-primary font-semibold underline-offset-2 hover:underline"
              onClick={() => router.push(`/admin/contests/${contestId}/live`)}
            >
              Live Monitor
            </button>{' '}
            (WebSocket).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-border/50 h-11"
            onClick={() => router.push(`/admin/contests/${contestId}/live`)}
          >
            <Activity className="h-4 w-4 mr-2" />
            Live Monitor
          </Button>
          <Button variant="outline" className="rounded-xl border-border/50 h-11" onClick={() => router.push(`/admin/contests/${contestId}/proctoring/events`)}>
            <Activity className="h-4 w-4 mr-2" />
            Full Event Log
          </Button>
          <Button className="rounded-xl h-11 bg-primary shadow-lg shadow-primary/20">
            Export Report
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <WidgetErrorBoundary name="Proctoring Overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden group hover:border-destructive/30 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Flagged</p>
                <p className="text-3xl font-extrabold text-destructive">{overview?.flaggedCount || '--'}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldAlert className="h-6 w-6 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden group hover:border-primary/30 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Avg Trust Score</p>
                <p className="text-3xl font-extrabold text-primary">{overview?.averageTrustScore || '--'}%</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden group hover:border-amber-500/30 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Violations</p>
                <p className="text-3xl font-extrabold text-amber-500">{overview?.totalViolations || '--'}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden group hover:border-green-500/30 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Clean Status</p>
                <p className="text-3xl font-extrabold text-green-500">{overview?.cleanCount || '--'}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UserCheck className="h-6 w-6 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </WidgetErrorBoundary>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Flagged Participants Table */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-destructive" />
              Flagged Participants
            </h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search flagged..." 
                className="pl-10 h-10 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <WidgetErrorBoundary name="Flagged Participants Table">
            <Card className="bg-background/50 border-border/50 rounded-2xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold">Participant</TableHead>
                    <TableHead className="font-bold">Violations</TableHead>
                    <TableHead className="font-bold">Trust Score</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFlaggedLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i} className="animate-pulse">
                        <TableCell colSpan={5} className="h-16 bg-secondary/10" />
                      </TableRow>
                    ))
                  ) : flaggedParticipants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                        No participants flagged for review. Good integrity!
                      </TableCell>
                    </TableRow>
                  ) : (
                    flaggedParticipants.map((p: any) => (
                      <TableRow key={p.participantId} className="hover:bg-secondary/20 transition-colors group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
                              <Users className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-bold text-sm leading-none mb-1">
                                {p.participant.contact.firstName} {p.participant.contact.lastName}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {p.participantId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="font-mono text-xs px-1.5 h-6">
                              {p.totalViolations}
                            </Badge>
                            {p.highSeverityCount > 0 && (
                              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] h-6 font-bold">
                                {p.highSeverityCount} Critical
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3 w-32">
                            <Progress value={p.trustScore} className="h-1.5 flex-1" />
                            <span className={cn("font-bold text-xs shrink-0", p.trustScore < 50 ? "text-destructive" : "text-amber-500")}>
                              {p.trustScore}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize font-bold text-[10px] px-2 py-0.5 border-border/50">
                            {p.participant.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-all opacity-0 group-hover:opacity-100"
                              onClick={() => router.push(`/admin/contests/${contestId}/proctoring/${p.participantId}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50">
                                <DropdownMenuItem onClick={() => router.push(`/admin/contests/${contestId}/proctoring/${p.participantId}`)}>
                                  <ShieldAlert className="h-4 w-4 mr-2" />
                                  Review Evidence
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => {
                                  if (window.confirm('Are you sure you want to disqualify this participant?')) {
                                    toast.success('Participant disqualified');
                                  }
                                }}>
                                  <Ban className="h-4 w-4 mr-2" />
                                  Disqualify
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </WidgetErrorBoundary>
        </div>

        {/* Violation Breakdown Sidebar */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-amber-500" />
            Issue Distribution
          </h2>

          <WidgetErrorBoundary name="Violation Distribution">
            <Card className="bg-background/50 border-border/50 rounded-3xl overflow-hidden shadow-sm">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  {Object.entries(overview?.byType || {}).map(([type, count]: [string, any]) => (
                    <div key={type} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-muted-foreground uppercase tracking-wider">{type.replace('_', ' ')}</span>
                        <span className="font-black text-foreground">{count}</span>
                      </div>
                      <Progress value={(count / (overview?.totalViolations || 1)) * 100} className="h-1.5 bg-secondary/50" />
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-border/50">
                  <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/10 text-center space-y-2">
                    <ShieldAlert className="h-8 w-8 text-destructive mx-auto opacity-50" />
                    <p className="text-xs text-muted-foreground font-medium">Critical Integrity Risk</p>
                    <p className="text-2xl font-black text-destructive">{overview?.disqualifiedCount || 0} Disqualified</p>
                    <p className="text-[10px] text-destructive/70 font-bold uppercase tracking-widest">Action Required</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </WidgetErrorBoundary>

          {/* Quick Help */}
          <Card className="bg-primary/5 border border-primary/10 rounded-3xl p-6">
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold">Proctoring Guide</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Participants are flagged when their trust score drops below 70%. Review snapshots and event logs before taking action.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
