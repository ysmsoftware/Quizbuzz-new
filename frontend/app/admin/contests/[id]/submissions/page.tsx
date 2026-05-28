'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  FileText, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  MoreVertical,
  Eye,
  Ban,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  User,
  ExternalLink,
  BookOpen,
  Award,
  HelpCircle,
  Info,
  RefreshCw,
  Mail,
  Zap,
  Check,
  X,
  Camera,
  ShieldAlert,
  ShieldCheck,
  Activity,
} from 'lucide-react';

import { 
  useContestSubmissions, 
  useContestSubmissionsStats, 
  useSubmissionDetail, 
  useInvalidateSubmission, 
  useBulkEvaluateSubmissions 
} from '@/lib/hooks/useSubmissions';
import { useParticipantCaptures, useParticipantProctoring } from '@/lib/hooks/useProctoring';

const isValidDate = (date: any) => {
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
};

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

interface SubmissionRecord {
  id: string;
  participantId: string;
  registrationRef?: string;
  contactName?: string;
  contactEmail?: string;
  status: 'PENDING' | 'SUBMITTED' | 'EVALUATED' | 'INVALIDATED';
  source?: string;
  score: number | string;
  percentage: number | string;
  isPassed?: boolean | null;
  timeTakenSecs?: number;
  submittedAt: string;
  evaluatedAt?: string;
  totalQuestions?: number;
  attempted?: number;
  participant?: {
    contact: {
      firstName: string;
      lastName: string;
      email: string;
    }
  }
}

export default function ContestSubmissionsPage() {
  const { id: contestId } = useParams() as { id: string };
  const router = useRouter();

  // Filters state
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Details modal state
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<'responses' | 'proctoring'>('responses');

  // Consolidated react-query hooks for modal detail
  const { data: detailData, isLoading: isDetailLoading, error: detailError } = useSubmissionDetail(selectedSubId);
  const submissionDetail = detailData?.data;

  // Proctoring captures — only fires when modal is open and participantId is known
  const { captures, loading: capturesLoading } = useParticipantCaptures(
    contestId,
    submissionDetail?.participantId,
  );

  const { detail: proctoringDetail, loading: proctoringLoading } = useParticipantProctoring(
      contestId,
      submissionDetail?.participantId || ''
  );
  const proctoringEvents = (proctoringDetail as any)?.events || [];

  // Check URL parameters to pre-open modal (from redirection)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const subIdParam = params.get('subId');
      if (subIdParam) {
        setSelectedSubId(subIdParam);
        // Silently clear the parameter from the address bar
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  // Consolidated react-query hooks
  const { data: submissionsData, isLoading: isSubmissionsLoading } = useContestSubmissions(contestId, { 
    status: status === 'all' ? undefined : status, 
    page, 
    limit: 20 
  });

  const { data: statsData } = useContestSubmissionsStats(contestId);
  const invalidateMutation = useInvalidateSubmission(contestId);
  const bulkEvaluateMutation = useBulkEvaluateSubmissions(contestId);

  // Mapped constants
  const submissions = (submissionsData?.data?.data || (submissionsData as any)?.data || []) as SubmissionRecord[];
  const pagination = submissionsData?.data?.pagination || (submissionsData as any)?.pagination;
  const stats = statsData?.data;

  // Filtered submissions based on search bar (fallback client filter)
  const filteredSubmissions = submissions.filter(sub => {
    if (!search) return true;
    const name = (sub.contactName || (sub.participant?.contact ? `${sub.participant.contact.firstName || ''} ${sub.participant.contact.lastName || ''}`.trim() : '')).toLowerCase();
    const email = (sub.contactEmail || sub.participant?.contact?.email || '').toLowerCase();
    const query = search.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const handleInvalidate = (subId: string) => {
    const reason = window.prompt('Enter reason for invalidation:');
    if (reason) {
      invalidateMutation.mutate({ submissionId: subId, reason });
    }
  };

  const handleBulkEvaluate = () => {
    if (window.confirm("Are you sure you want to trigger re-evaluation for all submissions in this contest?")) {
      bulkEvaluateMutation.mutate();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'EVALUATED':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1.5"><CheckCircle2 className="h-3 w-3" /> Evaluated</Badge>;
      case 'SUBMITTED':
      case 'PENDING':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1.5"><Clock className="h-3 w-3" /> Pending Evaluation</Badge>;
      case 'INVALIDATED':
        return <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 gap-1.5"><XCircle className="h-3 w-3" /> Invalidated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Submissions</h1>
          <p className="text-muted-foreground">Manage and review all participant responses for this contest.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl border-border/50">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button 
            className="rounded-xl bg-primary shadow-lg shadow-primary/20"
            onClick={handleBulkEvaluate}
            disabled={bulkEvaluateMutation.isPending}
          >
            {bulkEvaluateMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Evaluating...
              </>
            ) : (
              'Evaluate All'
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <WidgetErrorBoundary name="Submission Summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Submissions</p>
              <p className="text-3xl font-extrabold">{stats?.total ?? '--'}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Evaluated</p>
              <p className="text-3xl font-extrabold text-primary">{stats?.evaluated ?? '--'}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Pending Evaluation</p>
              <p className="text-3xl font-extrabold text-amber-500">{stats?.submitted ?? stats?.pending ?? '--'}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Invalidated</p>
              <p className="text-3xl font-extrabold text-destructive">{stats?.invalidated ?? '--'}</p>
            </CardContent>
          </Card>
        </div>
      </WidgetErrorBoundary>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or email..." 
            className="pl-10 h-11 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
            <SelectTrigger className="h-11 w-full md:w-48 rounded-xl bg-secondary/30 border-border/50">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/50">
              <SelectItem value="all">All Submissions</SelectItem>
              <SelectItem value="SUBMITTED">Pending Evaluation</SelectItem>
              <SelectItem value="EVALUATED">Evaluated</SelectItem>
              <SelectItem value="INVALIDATED">Invalidated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <WidgetErrorBoundary name="Submissions Table">
        <Card className="bg-background/50 border-border/50 rounded-2xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold">Participant</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold text-center">Attempted</TableHead>
                <TableHead className="font-bold text-center">Score</TableHead>
                <TableHead className="font-bold">Submitted At</TableHead>
                <TableHead className="font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isSubmissionsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={6} className="h-16 bg-secondary/10" />
                  </TableRow>
                ))
              ) : filteredSubmissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                    No submissions found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubmissions.map((sub: any) => (
                  <TableRow key={sub.id} className="hover:bg-secondary/20 transition-colors group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-sm leading-none">
                              {sub.contactName || (sub.participant?.contact ? `${sub.participant.contact.firstName || ''} ${sub.participant.contact.lastName || ''}`.trim() : 'Unknown Participant')}
                            </p>
                            {sub.registrationRef && (
                              <span className="text-[9px] bg-secondary/80 px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                                {sub.registrationRef}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {sub.contactEmail || sub.participant?.contact?.email || 'No email'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(sub.status)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {sub.attempted} / {sub.totalQuestions}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-primary">{sub.score !== null && sub.score !== undefined ? sub.score : '--'}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">({sub.percentage || 0}%)</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {sub.submittedAt ? format(new Date(sub.submittedAt), 'MMM dd, HH:mm') : '--'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-all opacity-0 group-hover:opacity-100"
                          onClick={() => setSelectedSubId(sub.id)}
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
                            <DropdownMenuItem onClick={() => setSelectedSubId(sub.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Breakdown
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleInvalidate(sub.id)}>
                              <Ban className="h-4 w-4 mr-2" />
                              Invalidate
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

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="p-4 border-t border-border/50 flex items-center justify-between bg-secondary/10">
              <p className="text-xs text-muted-foreground">
                Showing page {page} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 rounded-lg"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 rounded-lg"
                  disabled={page === pagination.pages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </WidgetErrorBoundary>

      {/* Premium Response Sheet Details Modal */}
      <Dialog open={!!selectedSubId} onOpenChange={(open) => { if (!open) { setSelectedSubId(null); setModalTab('responses'); } }}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[92vw] md:max-w-[90vw] lg:max-w-[85vw] xl:max-w-[75vw] max-h-[92vh] flex flex-col p-0 overflow-hidden border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl">
          {isDetailLoading ? (
            <div className="p-5 space-y-4 animate-pulse flex flex-col h-[500px]">
              <div className="flex justify-between items-center pb-4 border-b border-border/40 shrink-0">
                <div className="space-y-1.5">
                  <div className="h-5 w-48 bg-secondary rounded-lg" />
                  <div className="h-3.5 w-32 bg-secondary rounded-md" />
                </div>
                <div className="h-7 w-20 bg-secondary rounded-lg" />
              </div>
              <div className="flex-1 space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="h-24 bg-secondary rounded-xl" />
                  <div className="h-24 bg-secondary rounded-xl" />
                  <div className="h-24 bg-secondary rounded-xl" />
                </div>
                <div className="space-y-3 pt-2">
                  <div className="h-4 w-32 bg-secondary rounded-md" />
                  <div className="space-y-2">
                    <div className="h-16 bg-secondary/50 rounded-xl" />
                    <div className="h-16 bg-secondary/50 rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          ) : detailError || !submissionDetail ? (
            <div className="p-6 flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <h3 className="text-lg font-bold">Failed to load submission</h3>
              <p className="text-sm text-muted-foreground">There was an error fetching the submission breakdown.</p>
              <Button onClick={() => setSelectedSubId(null)} className="rounded-xl">Close</Button>
            </div>
          ) : (
            <div className="flex flex-col h-full min-h-0 overflow-hidden">
              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-border/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-secondary/5 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold tracking-tight">
                      {submissionDetail.contactName || (submissionDetail.participant?.contact ? `${submissionDetail.participant.contact.firstName || ''} ${submissionDetail.participant.contact.lastName || ''}`.trim() : 'Unknown Participant')}
                    </h2>
                    {submissionDetail.registrationRef && (
                      <span className="text-[10px] bg-secondary/80 px-2 py-0.5 rounded font-mono text-muted-foreground font-semibold">
                        {submissionDetail.registrationRef}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>{submissionDetail.contactEmail || submissionDetail.participant?.contact?.email || 'No Email'}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span>Submitted {submissionDetail.submittedAt ? format(new Date(submissionDetail.submittedAt), 'PPP p') : 'Unknown Date'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  {getStatusBadge(submissionDetail.status)}
                  {submissionDetail.source && (
                    <Badge variant="outline" className="capitalize px-2.5 py-0.5 text-[10px] font-semibold border-border/60">
                      {submissionDetail.source.toLowerCase()} Source
                    </Badge>
                  )}
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                <Tabs value={modalTab} onValueChange={(v) => setModalTab(v as any)} className="flex flex-col h-full">
                  <div className="px-5 pt-3 border-b border-border/30 bg-secondary/5 shrink-0">
                    <TabsList className="h-8 bg-transparent gap-1 p-0">
                      <TabsTrigger
                        value="responses"
                        className="h-8 px-3 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary bg-transparent shadow-none"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Responses
                      </TabsTrigger>
                      <TabsTrigger
                        value="proctoring"
                        className="h-8 px-3 text-xs font-bold rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary bg-transparent shadow-none"
                      >
                        <Camera className="h-3.5 w-3.5 mr-1.5" />
                        Proctoring
                        {captures.length > 0 && (
                          <span className="ml-1.5 bg-primary/10 text-primary text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                            {captures.length}
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Responses tab */}
                  <TabsContent value="responses" className="flex-1 overflow-y-auto px-5 py-4 space-y-4 m-0">

                {/* Stats Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Score & Accuracy Card */}
                  <Card className="bg-secondary/10 border-border/40 rounded-2xl shadow-sm overflow-hidden">
                    <CardContent className="px-4 py-3 flex flex-col justify-between h-full space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Score & Grade</span>
                        <Award className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1 mb-0.5">
                          <span className="text-2xl lg:text-3xl font-extrabold tracking-tight text-primary">
                            {submissionDetail.score !== null && submissionDetail.score !== undefined ? submissionDetail.score : '--'}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">points</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground font-medium">({submissionDetail.percentage || 0}% accuracy)</span>
                          {submissionDetail.isPassed !== null && submissionDetail.isPassed !== undefined && (
                            <Badge className={cn(
                              "text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider leading-none",
                              submissionDetail.isPassed 
                                ? "bg-green-500/10 text-green-500 border-green-500/20" 
                                : "bg-red-500/10 text-red-500 border-red-500/20"
                            )}>
                              {submissionDetail.isPassed ? 'PASSED' : 'FAILED'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-secondary/30 rounded-full h-1 overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            submissionDetail.isPassed ? "bg-green-500" : "bg-red-500"
                          )} 
                          style={{ width: `${submissionDetail.percentage || 0}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Time Taken Card */}
                  <Card className="bg-secondary/10 border-border/40 rounded-2xl shadow-sm overflow-hidden">
                    <CardContent className="px-4 py-3 flex flex-col justify-between h-full space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Time Taken</span>
                        <Clock className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl lg:text-3xl font-extrabold tracking-tight">
                          {formatTime(submissionDetail.timeTakenSecs)}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-tight">
                          Total allocated time tracked.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 w-max">
                        <Zap className="h-3 w-3 shrink-0" />
                        <span>Completed successfully</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Breakdown Card */}
                  <Card className="bg-secondary/10 border-border/40 rounded-2xl shadow-sm overflow-hidden">
                    <CardContent className="px-4 py-3 flex flex-col justify-between h-full space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Breakdown</span>
                        <BookOpen className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="bg-green-500/5 border border-green-500/10 p-1.5 rounded-lg">
                          <p className="text-[9px] font-semibold text-green-500 leading-none mb-0.5">Correct</p>
                          <p className="text-base font-bold text-green-600 leading-none">{submissionDetail.correct ?? 0}</p>
                        </div>
                        <div className="bg-red-500/5 border border-red-500/10 p-1.5 rounded-lg">
                          <p className="text-[9px] font-semibold text-red-500 leading-none mb-0.5">Wrong</p>
                          <p className="text-base font-bold text-red-600 leading-none">{submissionDetail.wrong ?? 0}</p>
                        </div>
                        <div className="bg-amber-500/5 border border-amber-500/10 p-1.5 rounded-lg">
                          <p className="text-[9px] font-semibold text-amber-500 leading-none mb-0.5">Skipped</p>
                          <p className="text-base font-bold text-amber-600 leading-none">{submissionDetail.skipped ?? 0}</p>
                        </div>
                      </div>
                      <div className="text-[9px] text-muted-foreground text-center font-medium leading-none">
                        Attempted <span className="font-bold text-foreground">{submissionDetail.attempted ?? 0}</span> / <span className="font-bold text-foreground">{submissionDetail.totalQuestions ?? 0}</span> questions.
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Answer Sheets */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Response Sheet & Answer Key
                  </h3>
                  
                  <div className="space-y-3">
                    {submissionDetail.answers?.map((ans: any, idx: number) => {
                      const isCorrect = ans.isCorrect;
                      const isSkipped = ans.selectedOptionId === null;
                      
                      let difficultyColor = "bg-secondary text-secondary-foreground";
                      if (ans.difficulty === "Easy") difficultyColor = "bg-green-500/10 text-green-500 border-green-500/20 border";
                      else if (ans.difficulty === "Medium") difficultyColor = "bg-amber-500/10 text-amber-500 border-amber-500/20 border";
                      else if (ans.difficulty === "Hard") difficultyColor = "bg-red-500/10 text-red-500 border-red-500/20 border";

                      return (
                        <div 
                          key={ans.questionId} 
                          className={cn(
                            "px-4 py-3.5 rounded-2xl border transition-all duration-300",
                            isCorrect 
                              ? "bg-emerald-500/[0.02] border-emerald-500/20 hover:border-emerald-500/30" 
                              : isSkipped
                                ? "bg-amber-500/[0.02] border-amber-500/20 hover:border-amber-500/30"
                                : "bg-rose-500/[0.02] border-rose-500/20 hover:border-rose-500/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-4 mb-2.5">
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-muted-foreground font-bold">Question {idx + 1}</span>
                              <h4 className="text-xs lg:text-sm font-semibold text-foreground leading-relaxed">
                                {ans.questionText}
                              </h4>
                            </div>
                            <Badge className={cn("text-[8px] font-bold px-1.5 py-0.5 border shrink-0", difficultyColor)}>
                              {ans.difficulty || "Standard"}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                            {/* Selected Option */}
                            <div className={cn(
                              "px-3 py-2.5 rounded-xl border flex flex-col justify-between space-y-1",
                              isCorrect 
                                ? "bg-emerald-500/[0.04] border-emerald-500/10 text-emerald-700 dark:text-emerald-400" 
                                : isSkipped
                                  ? "bg-amber-500/[0.04] border-amber-500/10 text-amber-700 dark:text-amber-400"
                                  : "bg-rose-500/[0.04] border-rose-500/10 text-rose-700 dark:text-rose-400"
                            )}>
                              <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-70">
                                Participant's Choice
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isCorrect ? (
                                  <Check className="h-3.5 w-3.5 shrink-0" />
                                ) : isSkipped ? (
                                  <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <X className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span className="text-xs font-bold leading-tight">
                                  {isSkipped ? 'Skipped Question' : (ans.selectedOptionText || 'Unknown Option')}
                                </span>
                              </div>
                            </div>

                            {/* Correct Option */}
                            <div className="px-3 py-2.5 bg-emerald-500/[0.04] border border-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl flex flex-col justify-between space-y-1">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-70">
                                Correct Answer
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 shrink-0" />
                                <span className="text-xs font-bold leading-tight">
                                  {ans.correctOptionText || 'No correct option set'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Explanation Block */}
                          {ans.explanation && (
                            <div className="mt-3 px-3 py-2 bg-blue-500/[0.03] border border-blue-500/10 rounded-xl text-blue-850 dark:text-blue-350">
                              <div className="flex items-start gap-2">
                                <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <span className="text-[9px] font-extrabold uppercase tracking-wider">Explanation</span>
                                  <p className="text-xs leading-relaxed font-medium">
                                    {ans.explanation}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

                  {/* Proctoring tab */}
                  <TabsContent value="proctoring" className="flex-1 overflow-y-auto px-5 py-4 m-0">
                    {capturesLoading ? (
                      <div className="grid grid-cols-2 gap-3">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="aspect-video rounded-xl bg-secondary/30 animate-pulse" />
                        ))}
                      </div>
                    ) : captures.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-muted/40 flex items-center justify-center">
                          <Camera className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">No snapshots captured</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Snapshot captures are only taken when violation thresholds are exceeded (5+ tab switches, 5+ fullscreen exits, 3+ multiple faces).
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                            <span>{captures.length} admin capture{captures.length !== 1 ? 's' : ''} — visible to admins only</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {captures.map((capture) => (
                              <div key={capture.id} className="space-y-1.5">
                                <div className="relative rounded-xl overflow-hidden border border-border/40 bg-secondary/10 aspect-video">
                                  <img
                                    src={capture.presignedGetUrl}
                                    alt={capture.captureType}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                  <div className="absolute top-1.5 left-1.5">
                                    <span className="bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                                      {capture.captureType.replace('SNAPSHOT_', '').replace('_', ' ')}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground text-center font-medium">
                                  {new Date(capture.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Proctoring Events Timeline */}
                        <div className="space-y-4 pt-4 border-t border-border/40">
                          <h3 className="text-sm font-bold flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Violation Feed
                          </h3>
                          {proctoringLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : proctoringEvents.length === 0 ? (
                            <div className="p-6 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col items-center justify-center text-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Perfect Integrity</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">No proctoring violations recorded for this session.</p>
                                </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
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
                                          <div className="p-2 rounded-lg border border-red-500/10 bg-red-500/5 flex flex-col items-center justify-center text-center">
                                              <span className="text-[9px] font-bold text-red-500/80 uppercase tracking-wider block">Severe</span>
                                              <span className="text-base font-extrabold text-red-600 dark:text-red-400 mt-0.5">{severeCount}</span>
                                          </div>
                                          <div className="p-2 rounded-lg border border-amber-500/10 bg-amber-500/5 flex flex-col items-center justify-center text-center">
                                              <span className="text-[9px] font-bold text-amber-500/80 uppercase tracking-wider block">Medium</span>
                                              <span className="text-base font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{mediumCount}</span>
                                          </div>
                                          <div className="p-2 rounded-lg border border-yellow-500/10 bg-yellow-500/5 flex flex-col items-center justify-center text-center">
                                              <span className="text-[9px] font-bold text-yellow-500/80 uppercase tracking-wider block">Low</span>
                                              <span className="text-base font-extrabold text-yellow-600 dark:text-yellow-400 mt-0.5">{lowCount}</span>
                                          </div>
                                      </div>
                                  );
                              })()}

                              <div className="max-h-[300px] overflow-y-auto pr-2 py-1 scrollbar-thin scrollbar-thumb-muted">
                                  <div className="relative border-l border-border/80 pl-4 ml-2.5 mr-0.5 space-y-5">
                                      {[...proctoringEvents]
                                          .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
                                          .map((event, idx) => {
                                              const eventTypeClean = event.type.replace("SNAPSHOT_", "").replace(/_/g, " ");
                                              
                                              let severityColor = "bg-yellow-500";
                                              let borderColor = "border-yellow-500/20";
                                              if (event.severity === 2) {
                                                  severityColor = "bg-amber-500";
                                                  borderColor = "border-amber-500/20";
                                              } else if (event.severity === 3) {
                                                  severityColor = "bg-red-500";
                                                  borderColor = "border-red-500/20";
                                              }

                                              return (
                                                  <div key={event.id || idx} className="relative group">
                                                      <div className={`absolute -left-[22px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ${severityColor} flex items-center justify-center`} />
                                                      
                                                      <div className={`p-3 rounded-lg border bg-card hover:bg-muted/10 transition-colors ${borderColor}`}>
                                                          <div className="flex items-start justify-between gap-2">
                                                              <div>
                                                                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 block">
                                                                      {eventTypeClean}
                                                                  </span>
                                                                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                                                                      {isValidDate(event.occurredAt) ? format(new Date(event.occurredAt), 'hh:mm:ss a') : '—'}
                                                                  </span>
                                                              </div>
                                                              <Badge variant="outline" className={`text-[10px] py-0 h-5 font-normal capitalize ${
                                                                  event.severity === 3 ? 'text-red-500 border-red-500/30' :
                                                                  event.severity === 2 ? 'text-amber-500 border-amber-500/30' :
                                                                  'text-yellow-500 border-yellow-500/30'
                                                              }`}>
                                                                  {event.severity === 3 ? 'high' : event.severity === 2 ? 'medium' : 'low'}
                                                              </Badge>
                                                          </div>
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
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 border-t border-border/40 flex justify-between items-center bg-secondary/5 rounded-b-2xl shrink-0">
                <div className="text-xs text-muted-foreground font-semibold">
                  Submission ID: <span className="font-mono">{submissionDetail.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  {submissionDetail.status !== 'INVALIDATED' && (
                    <Button 
                      variant="destructive" 
                      className="rounded-xl gap-1.5 h-9 px-3.5 text-xs font-semibold shadow-sm"
                      onClick={() => {
                        const reason = window.prompt("Enter reason for invalidation:");
                        if (reason) {
                          invalidateMutation.mutate({ submissionId: submissionDetail.id, reason });
                        }
                      }}
                      disabled={invalidateMutation.isPending}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Invalidate Submission
                    </Button>
                  )}
                  <Button 
                    variant="secondary" 
                    className="rounded-xl border border-border/60 h-9 px-4 text-xs font-bold hover:bg-secondary/40"
                    onClick={() => setSelectedSubId(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
