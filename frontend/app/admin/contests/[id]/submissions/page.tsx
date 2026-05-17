'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  ExternalLink
} from 'lucide-react';
import { submissionsApi } from '@/lib/api/post-quiz.api';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SubmissionSummary {
  totalSubmitted: number;
  totalEvaluated: number;
  totalPending: number;
  averageScore: string;
  highestScore: string;
  lowestScore: string;
}

interface SubmissionRecord {
  id: string;
  participantId: string;
  status: 'PENDING' | 'SUBMITTED' | 'EVALUATED' | 'INVALIDATED';
  submittedAt: string;
  totalQuestions: number;
  attempted: number;
  score: string;
  percentage: string;
  participant: {
    contact: {
      firstName: string;
      lastName: string;
      email: string;
    }
  }
}


import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function ContestSubmissionsPage() {
  const { id: contestId } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filters
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['submissions', contestId, { status, page }],
    queryFn: () => submissionsApi.getContestSubmissions(contestId, { 
      status: status === 'all' ? undefined : status, 
      page, 
      limit: 20 
    }),
  });

  const invalidateMutation = useMutation({
    mutationFn: ({ subId, reason }: { subId: string; reason: string }) => 
      submissionsApi.invalidateSubmission(subId, reason),
    onSuccess: () => {
      toast.success('Submission invalidated successfully');
      queryClient.invalidateQueries({ queryKey: ['submissions', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to invalidate submission');
    }
  });

  const submissions = (data?.data?.data || []) as SubmissionRecord[];
  const pagination = data?.data?.pagination;
  const summary = data?.data?.summary as SubmissionSummary | undefined;


  const handleInvalidate = (subId: string) => {
    const reason = window.prompt('Enter reason for invalidation:');
    if (reason) {
      invalidateMutation.mutate({ subId, reason });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'EVALUATED':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1.5"><CheckCircle2 className="h-3 w-3" /> Evaluated</Badge>;
      case 'SUBMITTED':
        return <Badge variant="secondary" className="gap-1.5"><Clock className="h-3 w-3" /> Pending Evaluation</Badge>;
      case 'INVALIDATED':
        return <Badge variant="destructive" className="gap-1.5"><XCircle className="h-3 w-3" /> Invalidated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
          <Button className="rounded-xl bg-primary shadow-lg shadow-primary/20">
            Evaluate All
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <WidgetErrorBoundary name="Submission Summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Submitted</p>
              <p className="text-3xl font-extrabold">{summary?.totalSubmitted || '--'}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Avg Score</p>
              <p className="text-3xl font-extrabold text-primary">{summary?.averageScore || '--'}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Highest Score</p>
              <p className="text-3xl font-extrabold text-green-500">{summary?.highestScore || '--'}</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Evaluated</p>
              <p className="text-3xl font-extrabold">{summary?.totalEvaluated || '--'}</p>
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
          <Select value={status} onValueChange={setStatus}>
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
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={6} className="h-16 bg-secondary/10" />
                  </TableRow>
                ))
              ) : submissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                    No submissions found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                submissions.map((sub: any) => (
                  <TableRow key={sub.id} className="hover:bg-secondary/20 transition-colors group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-sm leading-none mb-1">
                            {sub.participant.contact.firstName} {sub.participant.contact.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {sub.participant.contact.email}
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
                      <span className="font-bold text-primary">{sub.score}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">({sub.percentage}%)</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(sub.submittedAt), 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-all opacity-0 group-hover:opacity-100"
                          onClick={() => router.push(`/admin/contests/${contestId}/submissions/${sub.id}`)}
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
                            <DropdownMenuItem onClick={() => router.push(`/admin/contests/${contestId}/submissions/${sub.id}`)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Full Breakdown
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
          {pagination && pagination.totalPages > 1 && (
            <div className="p-4 border-t border-border/50 flex items-center justify-between bg-secondary/10">
              <p className="text-xs text-muted-foreground">
                Showing page {page} of {pagination.totalPages} ({pagination.total} total)
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
                  disabled={page === pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </WidgetErrorBoundary>
    </div>
  );
}
