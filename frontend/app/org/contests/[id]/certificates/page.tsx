'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Award, 
  Download, 
  RefreshCcw, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Send,
  Zap,
  AlertCircle,
  Settings2,
  Trash2
} from 'lucide-react';
import { useParticipants } from '@/lib/hooks/useParticipantCertificate';
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function CertificatesManagementPage() {
  const { id: contestId } = useParams() as { id: string };
  const router = useRouter();

  // Dashboard state
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Single Issuing form state
  const [issueParticipantId, setIssueParticipantId] = useState('');

  // Custom hook for participant & certificate queries/mutations
  const {
    certsData,
    isLoading,
    refetch,
    bulkIssueMutation,
    singleIssueMutation,
    retryMutation,
    retryAllFailedMutation
  } = useParticipants(contestId, { page, limit: 10, search, status });

  const paginatedRecords = certsData?.data?.data || [];
  const totalPages = certsData?.data?.pagination?.totalPages || 1;


  const summary = certsData?.data?.summary || { generated: 0, failed: 0, pending: 0 };
  const totalCerts = summary.generated + summary.failed + summary.pending;
  const progressPercent = totalCerts > 0 ? Math.round((summary.generated / totalCerts) * 100) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 gap-1.5 hover:bg-emerald-500/10"><CheckCircle2 className="h-3 w-3" /> Generated</Badge>;
      case 'FAILED':
        return <Badge variant="destructive" className="gap-1.5"><XCircle className="h-3 w-3" /> Failed</Badge>;
      case 'GENERATING':
        return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 gap-1.5 hover:bg-blue-500/10"><RefreshCcw className="h-3 w-3 animate-spin" /> Generating</Badge>;
      case 'QUEUED':
        return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 gap-1.5 hover:bg-amber-500/10"><Clock className="h-3 w-3 animate-pulse" /> Queued</Badge>;
      case 'NOT_GENERATED':
        return <Badge className="bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border border-zinc-500/20 gap-1.5 hover:bg-zinc-500/10"><AlertCircle className="h-3 w-3" /> Not Issued</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getParticipantStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/10 text-[9px] px-1.5 py-0 font-medium">Submitted</Badge>;
      case 'REGISTERED':
        return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/10 text-[9px] px-1.5 py-0 font-medium">Registered</Badge>;
      case 'DISQUALIFIED':
        return <Badge variant="destructive" className="text-[9px] px-1.5 py-0 font-medium">Disqualified</Badge>;
      default:
        return <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium">{status}</Badge>;
    }
  };

  const handleBulkIssue = () => {
    bulkIssueMutation.mutate();
  };

  const handleSingleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueParticipantId.trim()) {
      toast.error('Please provide a valid participant ID');
      return;
    }
    singleIssueMutation.mutate(issueParticipantId, {
      onSuccess: () => {
        setIssueParticipantId('');
      }
    });
  };

  const handleRetryAllFailed = () => {
    retryAllFailedMutation.mutate();
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 text-foreground">
      
      {/* Header controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-border pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Award className="text-amber-500 h-8 w-8" /> Certificate Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Configure certificate visual styling, orchestrate the Puppeteer worker queues, and issue official credentials.
          </p>
        </div>
        
        <div className="flex items-center gap-3">

          <Button variant="outline" className="rounded-xl" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Sync
          </Button>
          
          <Button 
            className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 dark:text-zinc-900 font-bold shadow-lg shadow-amber-500/10 cursor-pointer"
            onClick={handleBulkIssue}
            disabled={bulkIssueMutation.isPending}
          >
            {bulkIssueMutation.isPending ? (
              <RefreshCcw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Bulk Issue
          </Button>
        </div>
      </div>


          {/* Summary statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <Card className="bg-card border-border/50 shadow-xs rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <CardContent className="p-6">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Generated Credentials</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black text-foreground">{summary.generated}</p>
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-xs rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
              <CardContent className="p-6">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Failed Jobs</p>
                <div className="flex items-end justify-between">
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-foreground">{summary.failed}</p>
                    {summary.failed > 0 && (
                      <button 
                        onClick={handleRetryAllFailed}
                        disabled={retryAllFailedMutation.isPending}
                        className="text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCcw className="h-3 w-3" /> Retry All
                      </button>
                    )}
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-xs rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
              <CardContent className="p-6">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Queued / Processing</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black text-foreground">{summary.pending}</p>
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Clock className="h-6 w-6 animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50 shadow-xs rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <CardContent className="p-6">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Worker Progress</p>
                <div className="space-y-2 mt-1">
                  <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                    <span>{progressPercent}% Complete</span>
                    <span>{summary.generated}/{totalCerts}</span>
                  </div>
                  <Progress value={progressPercent} className="h-2 bg-muted [&>div]:bg-gradient-to-r [&>div]:from-blue-600 [&>div]:to-blue-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Searchable Table of Certificates */}
          <div className="space-y-4">
              
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search name, ref, or ID..." 
                    className="pl-10 h-10 rounded-xl bg-background border-border text-sm focus:border-amber-500 w-full"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                
                <Select 
                  value={status} 
                  onValueChange={(val) => {
                    setStatus(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-40 h-10 rounded-xl bg-background border-border text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-popover text-popover-foreground">
                    <SelectItem value="all" className="cursor-pointer">All Statuses</SelectItem>
                    <SelectItem value="GENERATED" className="cursor-pointer">Generated</SelectItem>
                    <SelectItem value="FAILED" className="cursor-pointer">Failed</SelectItem>
                    <SelectItem value="GENERATING" className="cursor-pointer">Generating</SelectItem>
                    <SelectItem value="QUEUED" className="cursor-pointer">Queued</SelectItem>
                    <SelectItem value="NOT_GENERATED" className="cursor-pointer">Not Issued</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="bg-card border-border/50 rounded-2xl overflow-hidden shadow-xs">
                <WidgetErrorBoundary name="Certificates Table">
                  <Table>
                    <TableHeader className="bg-muted/40 border-b border-border/50">
                      <TableRow className="hover:bg-transparent border-b border-border/50">
                        <TableHead className="font-bold text-muted-foreground text-xs py-4">Participant</TableHead>
                        <TableHead className="font-bold text-muted-foreground text-xs py-4">Status</TableHead>
                        <TableHead className="font-bold text-muted-foreground text-xs py-4">Generated At</TableHead>
                        <TableHead className="font-bold text-muted-foreground text-xs py-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i} className="animate-pulse border-b border-border/50">
                            <TableCell colSpan={4} className="h-16 bg-muted/20" />
                          </TableRow>
                        ))
                      ) : paginatedRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-36 text-center text-muted-foreground italic text-sm">
                            No participants matched the current criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedRecords.map((record) => (
                          <TableRow key={record.participant.id} className="hover:bg-muted/40 transition-colors border-b border-border/50 group">
                            
                            {/* Participant Name & Ref */}
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground border border-border/50">
                                  <Award className="h-4 w-4" />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-xs text-foreground leading-none">
                                      {record.participant?.contact?.firstName ?? 'Participant'} {record.participant?.contact?.lastName ?? ''}
                                    </p>
                                    {getParticipantStatusBadge(record.participant?.status)}
                                  </div>
                                  <p className="text-[9px] text-muted-foreground font-mono leading-none">
                                    Ref: {record.participant?.registrationRef ?? 'N/A'} • ID: {record.participant?.id ?? 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            {/* Status Badge */}
                            <TableCell className="py-4">
                              {getStatusBadge(record.certStatus)}
                            </TableCell>

                            {/* Timestamp */}
                            <TableCell className="text-xs text-muted-foreground py-4 font-mono">
                              {record.certificate?.generatedAt ? format(new Date(record.certificate.generatedAt), 'MMM dd, HH:mm') : '--'}
                            </TableCell>

                            {/* Actions dropdown */}
                            <TableCell className="text-right py-4">
                              <div className="flex items-center justify-end gap-1.5">
                                {record.certificate?.fileUrl ? (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg hover:bg-muted hover:text-foreground cursor-pointer"
                                    asChild
                                    title="Download Certificate"
                                  >
                                    <a href={record.certificate.fileUrl} target="_blank" rel="noopener noreferrer">
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </Button>
                                ) : null}

                                {(record.certStatus === 'FAILED' || record.certStatus === 'QUEUED' || record.certStatus === 'GENERATING') && record.certificate?.id ? (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg hover:bg-muted text-amber-500 cursor-pointer animate-in fade-in duration-200"
                                    onClick={() => record.certificate?.id && retryMutation.mutate(record.certificate.id)}
                                    disabled={retryMutation.isPending}
                                    title={record.certStatus === 'FAILED' ? "Retry failed generation" : "Rerun/re-queue stuck job"}
                                  >
                                    <RefreshCcw className={cn("h-3.5 w-3.5", retryMutation.isPending && "animate-spin")} />
                                  </Button>
                                ) : null}

                                {record.certStatus === 'NOT_GENERATED' ? (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 px-2.5 rounded-lg border-amber-500/30 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] cursor-pointer flex items-center gap-1 shadow-xs transition-all duration-200 animate-in fade-in duration-200"
                                    onClick={() => singleIssueMutation.mutate(record.participant.id)}
                                    disabled={singleIssueMutation.isPending}
                                  >
                                    <Zap className="h-3 w-3 fill-current" />
                                    Issue
                                  </Button>
                                ) : null}

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg cursor-pointer">
                                      <Settings2 className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48 rounded-xl border-border bg-popover text-popover-foreground">
                                    {record.certificate?.fileUrl && (
                                      <DropdownMenuItem 
                                        onClick={() => record.certificate?.id && window.open(`/quiz/${contestId}/certificate/${record.certificate.id}`)}
                                        className="cursor-pointer gap-2"
                                      >
                                        <ExternalLink className="h-4 w-4" /> View Public Page
                                      </DropdownMenuItem>
                                    )}
                                    {record.certificate?.id && (
                                      <DropdownMenuItem 
                                        onClick={() => record.certificate?.id && retryMutation.mutate(record.certificate.id)}
                                        className="cursor-pointer gap-2"
                                        disabled={retryMutation.isPending}
                                      >
                                        <RefreshCcw className="h-4 w-4" /> 
                                        {record.certStatus === 'GENERATED' ? 'Regenerate PDF' : 'Rerun / Retry Job'}
                                      </DropdownMenuItem>
                                    )}
                                    {record.certStatus === 'NOT_GENERATED' && (
                                      <DropdownMenuItem 
                                        onClick={() => singleIssueMutation.mutate(record.participant.id)}
                                        className="cursor-pointer gap-2 text-amber-500 hover:text-amber-400"
                                        disabled={singleIssueMutation.isPending}
                                      >
                                        <Zap className="h-4 w-4 fill-current" /> Issue Certificate
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem className="text-red-500 cursor-pointer gap-2 hover:text-red-400">
                                      <Trash2 className="h-4 w-4" /> Revoke Access
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
                </WidgetErrorBoundary>
              </Card>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">
                    Showing <span className="text-foreground font-bold">{paginatedRecords.length}</span> of <span className="text-foreground font-bold">{certsData?.data?.pagination?.total || 0}</span> entries
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl h-9 px-4 border-border bg-background text-xs"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl h-9 px-4 border-border bg-background text-xs"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

            </div>


    </div>
  );
}
