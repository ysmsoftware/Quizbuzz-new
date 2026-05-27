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
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Settings2,
  Brush,
  UserPlus,
  Trash2,
  Trophy
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

type CertificateTheme = 'royal' | 'midnight' | 'emerald';

export default function CertificatesManagementPage() {
  const { id: contestId } = useParams() as { id: string };
  const router = useRouter();

  // Dashboard state
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'dashboard' | 'designer'>('dashboard');

  // Designer Configurator state
  const [customTitle, setCustomTitle] = useState('Certificate of Accomplishment');
  const [previewTheme, setPreviewTheme] = useState<CertificateTheme>('royal');
  const [sigName, setSigName] = useState('Contest Director');
  const [sigTitle, setSigTitle] = useState('Lead Evaluator');

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
        
        {/* Toggle Designer and Dashboard View */}
        <div className="flex items-center gap-3">
          <div className="flex border border-border bg-secondary/50 p-1 rounded-xl">
            <Button
              variant="ghost"
              className={cn(
                "rounded-lg px-4 h-9 text-xs font-semibold cursor-pointer",
                viewMode === 'dashboard' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setViewMode('dashboard')}
            >
              Queue Monitor
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "rounded-lg px-4 h-9 text-xs font-semibold cursor-pointer",
                viewMode === 'designer' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setViewMode('designer')}
            >
              <Brush className="h-3.5 w-3.5 mr-1" /> Template Studio
            </Button>
          </div>

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

      {viewMode === 'dashboard' ? (
        <>
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
        </>
      ) : (
        /* Designer Template Configurator split-screen */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Configurator Controls */}
          <Card className="bg-card border-border/50 shadow-xs rounded-3xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-amber-500" /> Certificate Configurator
              </h3>
              <p className="text-xs text-muted-foreground">
                Design the visual template that Puppeteer uses to render credentials. Changes apply dynamically to all generated PDFs.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-muted-foreground">Certificate Title text</span>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Certificate of Accomplishment"
                  className="h-11 rounded-xl bg-background border-border text-sm focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-muted-foreground">Signature Author Name</span>
                <Input
                  value={sigName}
                  onChange={(e) => setSigName(e.target.value)}
                  placeholder="Contest Director"
                  className="h-11 rounded-xl bg-background border-border text-sm focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-muted-foreground">Signature Title</span>
                <Input
                  value={sigTitle}
                  onChange={(e) => setSigTitle(e.target.value)}
                  placeholder="Lead Evaluator"
                  className="h-11 rounded-xl bg-background border-border text-sm focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-muted-foreground">Theme Stylesheet Preview</span>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'royal', label: 'Royal Gold' },
                    { id: 'midnight', label: 'Midnight Blue' },
                    { id: 'emerald', label: 'Emerald Merit' }
                  ].map((themeBtn) => (
                    <button
                      key={themeBtn.id}
                      onClick={() => setPreviewTheme(themeBtn.id as CertificateTheme)}
                      className={cn(
                        "h-10 rounded-xl border text-xs font-semibold cursor-pointer transition-all",
                        previewTheme === themeBtn.id
                          ? "bg-primary border-primary text-primary-foreground shadow-xs"
                          : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {themeBtn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/50">
              <Button 
                onClick={() => toast.success('Certificate layout saved successfully')}
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Save Layout Configuration
              </Button>
            </div>
          </Card>

          {/* Live Mock Preview Canvas */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" /> Live Canvas Render Mockup
              </h4>
              <span className="text-[10px] text-muted-foreground italic">Preformatted for 8.5" x 11" aspect ratio</span>
            </div>

            <div 
              style={{
                borderColor: 
                  previewTheme === 'royal' ? 'rgba(212, 175, 55, 0.3)' : 
                  previewTheme === 'midnight' ? 'rgba(37, 99, 235, 0.3)' : 
                  'rgba(16, 185, 129, 0.3)',
                background: 
                  previewTheme === 'royal' ? 'linear-gradient(135deg, #110e08 0%, #1a160d 100%)' : 
                  previewTheme === 'midnight' ? 'linear-gradient(135deg, #0b0f19 0%, #0d1527 100%)' : 
                  'linear-gradient(135deg, #08110e 0%, #0c1c16 100%)'
              }}
              className="w-full aspect-[1.414/1] rounded-3xl border relative overflow-hidden select-none p-10 flex flex-col justify-between items-center text-center transition-all duration-300"
            >
              {/* Inner ornaments */}
              <div className="absolute inset-3 rounded-2xl border border-dashed pointer-events-none opacity-40 border-neutral-700" />
              <div className={`absolute inset-4 rounded-2xl border-2 pointer-events-none transition-all duration-300 ${
                previewTheme === 'royal' ? 'border-amber-500/10' : 
                previewTheme === 'midnight' ? 'border-blue-500/10' : 
                'border-emerald-500/10'
              }`} />

              <div className="space-y-0.5">
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-[0.4em] transition-all",
                  previewTheme === 'royal' ? 'text-amber-500' : 
                  previewTheme === 'midnight' ? 'text-blue-400' : 
                  'text-emerald-400'
                )}>
                  {customTitle}
                </span>
                <h2 className="text-xl font-serif font-bold text-white tracking-wide mt-1">
                  QUIZBUZZ CHAMPIONSHIP
                </h2>
              </div>

              <div className="space-y-1 mt-2">
                <p className="text-[10px] italic text-neutral-400 font-serif">
                  This secure credential is proudly presented to
                </p>
                <h3 className="text-2xl font-extrabold text-white tracking-tight">
                  Alexander Mercer
                </h3>
                <div className={cn(
                  "h-[1.5px] w-20 mx-auto rounded-full mt-2",
                  previewTheme === 'royal' ? 'bg-amber-500/40' : 
                  previewTheme === 'midnight' ? 'bg-blue-500/40' : 
                  'bg-emerald-500/40'
                )} />
              </div>

              <p className="text-[10px] text-neutral-300 max-w-sm leading-relaxed mt-1">
                for demonstrating exceptional performance and mastery in the official evaluation
                <span className="block font-black text-white text-[11px] mt-0.5">Global Hackathon Finals</span>
              </p>

              {/* Mock Metric Stats */}
              <div className="grid grid-cols-3 gap-2 bg-neutral-950/60 border border-neutral-900 px-4 py-2 rounded-xl mt-2 w-full max-w-xs text-center">
                <div>
                  <span className="text-[8px] uppercase text-neutral-500 block">Score</span>
                  <span className={cn(
                    "text-xs font-black font-mono",
                    previewTheme === 'royal' ? 'text-amber-400' : 
                    previewTheme === 'midnight' ? 'text-blue-400' : 
                    'text-emerald-400'
                  )}>
                    95%
                  </span>
                </div>
                <div className="border-x border-neutral-900">
                  <span className="text-[8px] uppercase text-neutral-500 block">Rank</span>
                  <span className="text-xs font-black font-mono text-white">
                    #3
                  </span>
                </div>
                <div>
                  <span className="text-[8px] uppercase text-neutral-500 block">Duration</span>
                  <span className="text-xs font-black font-mono text-neutral-300">
                    4m 12s
                  </span>
                </div>
              </div>

              {/* Signatures Footer */}
              <div className="w-full flex justify-between items-end mt-2">
                <div className="text-left w-1/3">
                  <div className="h-6 flex items-center justify-start pointer-events-none">
                    <svg className="h-6 text-neutral-500 stroke-current opacity-60" viewBox="0 0 100 40">
                      <path d="M10,25 Q30,5 50,30 T90,20" fill="none" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="border-t border-neutral-800 pt-0.5 mt-0.5">
                    <p className="text-[8px] font-bold text-neutral-300 leading-none">{sigName}</p>
                    <p className="text-[6px] text-neutral-500 mt-0.5">{sigTitle}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center w-1/3 relative">
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" className={cn(
                        "stroke-dashed opacity-50",
                        previewTheme === 'royal' ? 'text-amber-500' : 
                        previewTheme === 'midnight' ? 'text-blue-500' : 
                        'text-emerald-500'
                      )} />
                    </svg>
                    <Trophy className={cn(
                      "absolute h-4 w-4",
                      previewTheme === 'royal' ? 'text-amber-500' : 
                      previewTheme === 'midnight' ? 'text-blue-500' : 
                      'text-emerald-500'
                    )} />
                  </div>
                  <span className="text-[6px] tracking-widest text-emerald-400 font-bold uppercase mt-0.5 flex items-center gap-0.5">
                    <ShieldCheck className="h-1.5 w-1.5" /> SECURE
                  </span>
                </div>

                <div className="text-right w-1/3 flex flex-col items-end">
                  <div className="bg-neutral-800 h-6 w-6 rounded flex items-center justify-center text-neutral-600 font-mono text-[6px] mb-1">
                    [QR]
                  </div>
                  <div className="border-t border-neutral-800 pt-0.5 w-full text-right">
                    <p className="text-[8px] font-bold text-neutral-300 leading-none">Security Reference</p>
                    <p className="text-[6px] text-neutral-500 mt-0.5 font-mono">SEC-REF-PREVIEW</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
