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
  Ban,
  Loader2
} from 'lucide-react';
import { proctoringApi } from '@/lib/api/post-quiz.api';
import { disqualifyParticipant } from '@/lib/api/contests.api';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription, 
  SheetFooter 
} from '@/components/ui/sheet';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { useParticipantProctoring } from '@/lib/hooks/useProctoring';

const isValidDate = (date: any) => {
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
};
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
  
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  
  const [disqualifyParticipantId, setDisqualifyParticipantId] = useState<string | null>(null);
  const [disqualifyReason, setDisqualifyReason] = useState('');

  // Queries
  const { data: overviewData, isLoading: isOverviewLoading } = useQuery({
    queryKey: ['proctoring-overview', contestId],
    queryFn: () => proctoringApi.getOverview(contestId),
  });

  const { data: flaggedData, isLoading: isFlaggedLoading } = useQuery({
    queryKey: ['proctoring-flagged', contestId, { page }],
    queryFn: () => proctoringApi.getFlaggedParticipants(contestId, { page, limit: 20, isFlagged: undefined }),
  });

  const { detail: proctoringDetail, loading: proctoringLoading } = useParticipantProctoring(
      contestId,
      selectedParticipantId || ''
  );
  const proctoringEvents = (proctoringDetail as any)?.events || [];

  const overview = overviewData?.data as ProctoringOverview | undefined;
  // Backend /flagged endpoint returns: { scores: [...], total: N }
  const rawFlagged = flaggedData?.data || {};
  const flaggedParticipants = (rawFlagged.scores || rawFlagged.data || []) as FlaggedParticipant[];
  const pagination = rawFlagged.pagination ?? (rawFlagged.total != null ? { total: rawFlagged.total, page, limit: 20 } : undefined);

  const disqualifyMutation = useMutation({
    mutationFn: () => disqualifyParticipant(contestId, disqualifyParticipantId as string, disqualifyReason.trim()),
    onSuccess: () => {
      toast.success('Participant disqualified successfully.');
      queryClient.invalidateQueries({ queryKey: ['proctoring-flagged', contestId] });
      queryClient.invalidateQueries({ queryKey: ['proctoring-overview', contestId] });
      setDisqualifyParticipantId(null);
      setDisqualifyReason('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to disqualify participant.');
    },
  });

  const getTrustScoreColor = (score: number) => {
    if (score >= 90) return 'text-success bg-success/10 border-success/20';
    if (score >= 70) return 'text-warning bg-warning/10 border-warning/20';
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

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden group hover:border-warning/30 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Violations</p>
                <p className="text-3xl font-extrabold text-warning">{overview?.totalViolations || '--'}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-warning/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden group hover:border-success/30 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Clean Status</p>
                <p className="text-3xl font-extrabold text-success">{overview?.cleanCount || '--'}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UserCheck className="h-6 w-6 text-success" />
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
                      <TableRow 
                        key={p.participantId} 
                        className={cn("hover:bg-secondary/20 transition-colors group cursor-pointer", p.isFlagged && "bg-destructive/5")}
                        onClick={() => setSelectedParticipantId(p.participantId)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", p.isFlagged ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
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
                              <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px] h-6 font-bold">
                                {p.highSeverityCount} Critical
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3 w-32">
                            <Progress value={p.trustScore} className="h-1.5 flex-1" />
                            <span className={cn("font-bold text-xs shrink-0", p.trustScore < 50 ? "text-destructive" : "text-warning")}>
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
                              className="touch-target rounded-lg hover:bg-primary/10 hover:text-primary transition-all opacity-0 group-hover:opacity-100"
                              onClick={(e) => { e.stopPropagation(); setSelectedParticipantId(p.participantId); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="touch-target rounded-lg" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedParticipantId(p.participantId); }}>
                                  <ShieldAlert className="h-4 w-4 mr-2" />
                                  Review Evidence
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={(e) => {
                                  e.stopPropagation();
                                  setDisqualifyParticipantId(p.participantId);
                                  setDisqualifyReason('');
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
            <TrendingDown className="h-5 w-5 text-warning" />
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
                    <p className="text-[10px] text-destructive font-bold uppercase tracking-widest">Action Required</p>
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

      {/* Participant Proctoring Drawer */}
      <Sheet open={!!selectedParticipantId} onOpenChange={(open) => !open && setSelectedParticipantId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-background/95 backdrop-blur-xl border-l-border/50">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-primary" />
              Proctoring Timeline
            </SheetTitle>
            <SheetDescription>
              Review the detailed proctoring activity and violations for this participant.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            <div className="space-y-4">
                {proctoringLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : proctoringEvents.length === 0 ? (
                    <div className="p-6 rounded-xl bg-success/5 border border-success/20 flex flex-col items-center justify-center text-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center text-success">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-success">Perfect Integrity</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">No proctoring violations recorded for this session.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Summary Grid */}
                        {(() => {
                            const lowCount = proctoringEvents.filter((e: any) => e.severity === 1 || !e.severity).length;
                            const mediumCount = proctoringEvents.filter((e: any) => e.severity === 2).length;
                            const severeCount = proctoringEvents.filter((e: any) => e.severity === 3).length;
                            const totalCount = proctoringEvents.length;

                            return (
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="p-2 rounded-lg border bg-muted/30 flex flex-col items-center justify-center text-center">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Total</span>
                                        <span className="text-base font-extrabold text-foreground mt-0.5">{totalCount}</span>
                                    </div>
                                    <div className="p-2 rounded-lg border border-destructive/10 bg-destructive/5 flex flex-col items-center justify-center text-center">
                                        <span className="text-[9px] font-bold text-destructive uppercase tracking-wider block">Severe</span>
                                        <span className="text-base font-extrabold text-destructive mt-0.5">{severeCount}</span>
                                    </div>
                                    <div className="p-2 rounded-lg border border-warning/10 bg-warning/5 flex flex-col items-center justify-center text-center">
                                        <span className="text-[9px] font-bold text-warning uppercase tracking-wider block">Medium</span>
                                        <span className="text-base font-extrabold text-warning mt-0.5">{mediumCount}</span>
                                    </div>
                                    <div className="p-2 rounded-lg border border-muted-foreground/10 bg-muted/30 flex flex-col items-center justify-center text-center">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Low</span>
                                        <span className="text-base font-extrabold text-muted-foreground mt-0.5">{lowCount}</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Scrollable Timeline */}
                        <div className="max-h-[500px] overflow-y-auto pr-2 py-1 scrollbar-thin scrollbar-thumb-muted">
                            <div className="relative border-l border-border/80 pl-4 ml-2.5 mr-0.5 space-y-5">
                                {[...proctoringEvents]
                                    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
                                    .map((event, idx) => {
                                        const eventTypeClean = event.type.replace("SNAPSHOT_", "").replace(/_/g, " ");
                                        
                                        let severityColor = "bg-muted-foreground";
                                        let borderColor = "border-muted-foreground/20";
                                        if (event.severity === 2) {
                                            severityColor = "bg-warning";
                                            borderColor = "border-warning/20";
                                        } else if (event.severity === 3) {
                                            severityColor = "bg-destructive";
                                            borderColor = "border-destructive/20";
                                        }

                                        return (
                                            <div key={event.id || idx} className="relative group">
                                                {/* Timeline Node */}
                                                <div className={`absolute -left-[22px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ${severityColor} flex items-center justify-center`} />
                                                
                                                <div className={`p-3 rounded-lg border bg-card hover:bg-muted/10 transition-colors ${borderColor}`}>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                                                                {eventTypeClean}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground mt-0.5 block">
                                                                {isValidDate(event.occurredAt) ? format(new Date(event.occurredAt), 'hh:mm:ss a') : '—'}
                                                            </span>
                                                        </div>
                                                        <Badge variant="outline" className={`text-[10px] py-0 h-5 font-normal capitalize ${
                                                            event.severity === 3 ? 'text-destructive border-destructive/30' :
                                                            event.severity === 2 ? 'text-warning border-warning/30' :
                                                            'text-muted-foreground border-muted-foreground/30'
                                                        }`}>
                                                            {event.severity === 3 ? 'high' : event.severity === 2 ? 'medium' : 'low'}
                                                        </Badge>
                                                    </div>

                                                    {/* If snapshot exists, display thumbnail */}
                                                    {event.snapshotUrl && (
                                                        <div className="mt-2.5 relative w-24 h-16 rounded border border-border/60 overflow-hidden cursor-pointer hover:opacity-85 transition-opacity group-hover:scale-102 duration-200" onClick={() => setPreviewPhotoUrl(event.snapshotUrl)}>
                                                            <img src={event.snapshotUrl} alt="Violation" className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                                <Eye className="h-4 w-4" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </div>
          <SheetFooter className="mt-6 flex gap-2">
            <Button variant="outline" onClick={() => setSelectedParticipantId(null)}>Close</Button>
            <Button variant="destructive" onClick={() => {
              setDisqualifyParticipantId(selectedParticipantId);
              setDisqualifyReason('');
              setSelectedParticipantId(null);
            }}>
              Disqualify Participant
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Snapshot Preview Dialog */}
      <Dialog open={!!previewPhotoUrl} onOpenChange={(open) => !open && setPreviewPhotoUrl(null)}>
        <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-800 text-white p-2">
          <DialogHeader className="hidden">
            <DialogTitle>Snapshot Preview</DialogTitle>
          </DialogHeader>
          {previewPhotoUrl && (
            <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-slate-950 flex flex-col items-center justify-center">
              <img src={previewPhotoUrl} alt="Violation Snapshot" className="max-w-full max-h-full object-contain" />
              <Button 
                variant="outline" 
                size="icon" 
                className="absolute top-4 right-4 bg-slate-900/80 border-slate-700 text-white hover:bg-slate-800 hover:text-white"
                onClick={() => setPreviewPhotoUrl(null)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disqualify Confirmation Dialog */}
      <Dialog
        open={!!disqualifyParticipantId}
        onOpenChange={(open) => {
          if (!open && !disqualifyMutation.isPending) {
            setDisqualifyParticipantId(null);
            setDisqualifyReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Disqualify Participant
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. The participant's score will be invalidated and they will be marked as disqualified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Reason for disqualification <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={disqualifyReason}
                onChange={(e) => setDisqualifyReason(e.target.value)}
                placeholder="e.g. Detected use of an external device, repeated tab-switching violations..."
                rows={3}
                maxLength={500}
                disabled={disqualifyMutation.isPending}
                className={cn(disqualifyReason.trim().length > 0 && disqualifyReason.trim().length < 5 ? 'border-destructive focus-visible:ring-destructive' : '')}
              />
              {disqualifyReason.trim().length > 0 && disqualifyReason.trim().length < 5 ? (
                <p className="text-xs text-destructive">Reason must be at least 5 characters.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Recorded against this participant's proctoring record.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDisqualifyParticipantId(null)} disabled={disqualifyMutation.isPending}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={disqualifyReason.trim().length < 5 || disqualifyMutation.isPending}
              onClick={() => disqualifyMutation.mutate()}
            >
              {disqualifyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disqualifying...
                </>
              ) : (
                'Confirm Disqualification'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
