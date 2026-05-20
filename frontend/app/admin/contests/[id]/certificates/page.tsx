'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { certificatesApi, CertificateRecord } from '@/lib/api/results-certs.api';
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
  const queryClient = useQueryClient();

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

  // Queries
  const { data: certsData, isLoading, refetch } = useQuery({
    queryKey: ['certificates', contestId, { page }],
    queryFn: () => certificatesApi.getContestCertificates(contestId, { 
      page, 
      limit: 20 
    }),
  });

  // Mutations
  const bulkIssueMutation = useMutation({
    mutationFn: () => certificatesApi.bulkIssueCertificates({ contestId }),
    onSuccess: () => {
      toast.success('Bulk certificate generation successfully queued');
      queryClient.invalidateQueries({ queryKey: ['certificates', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to trigger bulk issuance');
    },
  });

  const singleIssueMutation = useMutation({
    mutationFn: (participantId: string) => certificatesApi.issueCertificate({ participantId }),
    onSuccess: () => {
      toast.success('Certificate queued for participant');
      setIssueParticipantId('');
      queryClient.invalidateQueries({ queryKey: ['certificates', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to issue individual certificate');
    },
  });

  const retryMutation = useMutation({
    mutationFn: (certId: string) => certificatesApi.retryCertificate(certId),
    onSuccess: () => {
      toast.success('Re-generation job successfully queued');
      queryClient.invalidateQueries({ queryKey: ['certificates', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to retry generation');
    },
  });

  const retryAllFailedMutation = useMutation({
    mutationFn: () => certificatesApi.retryFailedCertificates({ contestId }),
    onSuccess: (data: any) => {
      toast.success(data?.message || 'All failed generation jobs re-queued successfully');
      queryClient.invalidateQueries({ queryKey: ['certificates', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to retry all failed certificates');
    },
  });

  const rawCertificates = certsData?.data?.data || [];
  
  // Filter client-side based on search query
  const certificates = rawCertificates.filter((cert: any) => {
    // Filter status
    if (status !== 'all' && cert.status !== status) return false;
    
    // Filter search text
    if (search.trim()) {
      const query = search.toLowerCase();
      const firstName = cert.participant?.contact?.firstName?.toLowerCase() || '';
      const lastName = cert.participant?.contact?.lastName?.toLowerCase() || '';
      const email = cert.participant?.contact?.email?.toLowerCase() || '';
      const ref = cert.participant?.registrationRef?.toLowerCase() || '';
      const id = cert.id?.toLowerCase() || '';

      return firstName.includes(query) || lastName.includes(query) || email.includes(query) || ref.includes(query) || id.includes(query);
    }

    return true;
  });

  const pagination = certsData?.data?.pagination;
  const summary = certsData?.data?.summary || { generated: 0, failed: 0, pending: 0 };
  const totalCerts = summary.generated + summary.failed + summary.pending;
  const progressPercent = totalCerts > 0 ? Math.round((summary.generated / totalCerts) * 100) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-1.5"><CheckCircle2 className="h-3 w-3" /> Generated</Badge>;
      case 'FAILED':
        return <Badge variant="destructive" className="gap-1.5"><XCircle className="h-3 w-3" /> Failed</Badge>;
      case 'GENERATING':
        return <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 gap-1.5"><RefreshCcw className="h-3 w-3 animate-spin" /> Generating</Badge>;
      case 'QUEUED':
        return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 gap-1.5"><Clock className="h-3 w-3 animate-pulse" /> Queued</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
    singleIssueMutation.mutate(issueParticipantId);
  };

  const handleRetryAllFailed = () => {
    retryAllFailedMutation.mutate();
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 text-neutral-200">
      
      {/* Header controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-neutral-900 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
            <Award className="text-amber-500 h-8 w-8" /> Certificate Management
          </h1>
          <p className="text-neutral-400 text-sm">
            Configure certificate visual styling, orchestrate the Puppeteer worker queues, and issue official credentials.
          </p>
        </div>
        
        {/* Toggle Designer and Dashboard View */}
        <div className="flex items-center gap-3">
          <div className="flex border border-neutral-800 bg-neutral-950 p-1 rounded-xl">
            <Button
              variant="ghost"
              className={cn(
                "rounded-lg px-4 h-9 text-xs font-semibold cursor-pointer",
                viewMode === 'dashboard' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
              )}
              onClick={() => setViewMode('dashboard')}
            >
              Queue Monitor
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "rounded-lg px-4 h-9 text-xs font-semibold cursor-pointer",
                viewMode === 'designer' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
              )}
              onClick={() => setViewMode('designer')}
            >
              <Brush className="h-3.5 w-3.5 mr-1" /> Template Studio
            </Button>
          </div>

          <Button variant="outline" className="rounded-xl border-neutral-800 bg-neutral-900/40 text-neutral-300 hover:text-white" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Sync
          </Button>
          
          <Button 
            className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-bold shadow-lg shadow-amber-500/10 cursor-pointer"
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
            
            <Card className="bg-neutral-950/40 border-neutral-900 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <CardContent className="p-6">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Generated Credentials</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black text-white">{summary.generated}</p>
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-950/40 border-neutral-900 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
              <CardContent className="p-6">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Failed Jobs</p>
                <div className="flex items-end justify-between">
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-white">{summary.failed}</p>
                    {summary.failed > 0 && (
                      <button 
                        onClick={handleRetryAllFailed}
                        disabled={retryAllFailedMutation.isPending}
                        className="text-xs font-semibold text-red-400 underline cursor-pointer flex items-center gap-1 hover:text-red-300"
                      >
                        <RefreshCcw className="h-3 w-3" /> Retry All
                      </button>
                    )}
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-950/40 border-neutral-900 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
              <CardContent className="p-6">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Queued / Processing</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black text-white">{summary.pending}</p>
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <Clock className="h-6 w-6 animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-950/40 border-neutral-900 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <CardContent className="p-6">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Worker Progress</p>
                <div className="space-y-2 mt-1">
                  <div className="flex justify-between items-center text-xs font-bold text-neutral-400">
                    <span>{progressPercent}% Complete</span>
                    <span>{summary.generated}/{totalCerts}</span>
                  </div>
                  <Progress value={progressPercent} className="h-2 bg-neutral-900 [&>div]:bg-gradient-to-r [&>div]:from-blue-600 [&>div]:to-blue-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Single Issue & Search Filters Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Queue controls / Single Issue Form */}
            <div className="space-y-6">
              
              <Card className="bg-neutral-950/20 border-neutral-900 rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-amber-500" /> Issue Individual Certificate
                  </CardTitle>
                  <CardDescription className="text-xs text-neutral-400">
                    Directly queue a certificate generation job for a single participant by specifying their ID.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSingleIssueSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Input
                        placeholder="Enter Participant ID..."
                        value={issueParticipantId}
                        onChange={(e) => setIssueParticipantId(e.target.value)}
                        className="h-10 rounded-xl bg-neutral-950 border-neutral-800 text-sm focus:border-amber-500"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-10 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      disabled={singleIssueMutation.isPending}
                    >
                      {singleIssueMutation.isPending ? (
                        <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      Trigger Generation
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-neutral-950/20 border-neutral-900 rounded-2xl p-6 space-y-4">
                <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Worker Engine Logs
                </h4>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  The generation queue is driven by a BullMQ server offloading high-fidelity HTML parsing tasks to headless Chromium engines.
                </p>
                <div className="font-mono text-[9px] bg-neutral-950 p-3 rounded-lg border border-neutral-900 text-neutral-500 space-y-1">
                  <div>[QUEUE] Ready & waiting for jobs...</div>
                  <div>[WORKER] Active concurrency set to 3.</div>
                  {summary.pending > 0 && <div className="text-amber-500 animate-pulse">[PROCESSING] Rendering page inputs in Puppeteer sandbox...</div>}
                </div>
              </Card>

            </div>

            {/* Right Column: Searchable Table of Certificates */}
            <div className="lg:col-span-2 space-y-4">
              
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                  <Input 
                    placeholder="Search name, ref, or ID..." 
                    className="pl-10 h-10 rounded-xl bg-neutral-950 border-neutral-900 text-sm focus:border-amber-500 w-full"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-40 h-10 rounded-xl bg-neutral-950 border-neutral-900 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-neutral-900 bg-neutral-950 text-neutral-200">
                    <SelectItem value="all" className="cursor-pointer">All Statuses</SelectItem>
                    <SelectItem value="GENERATED" className="cursor-pointer">Generated</SelectItem>
                    <SelectItem value="FAILED" className="cursor-pointer">Failed</SelectItem>
                    <SelectItem value="GENERATING" className="cursor-pointer">Generating</SelectItem>
                    <SelectItem value="QUEUED" className="cursor-pointer">Queued</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="bg-neutral-950/40 border-neutral-900 rounded-2xl overflow-hidden shadow-2xl">
                <WidgetErrorBoundary name="Certificates Table">
                  <Table>
                    <TableHeader className="bg-neutral-950 border-b border-neutral-900">
                      <TableRow className="hover:bg-transparent border-b-neutral-900">
                        <TableHead className="font-bold text-neutral-400 text-xs py-4">Participant</TableHead>
                        <TableHead className="font-bold text-neutral-400 text-xs py-4">Status</TableHead>
                        <TableHead className="font-bold text-neutral-400 text-xs py-4">Generated At</TableHead>
                        <TableHead className="font-bold text-neutral-400 text-xs py-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i} className="animate-pulse border-b-neutral-900/50">
                            <TableCell colSpan={4} className="h-16 bg-neutral-950/20" />
                          </TableRow>
                        ))
                      ) : certificates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-36 text-center text-neutral-500 italic text-sm">
                            No certificates matched the current criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        certificates.map((cert) => (
                          <TableRow key={cert.id} className="hover:bg-neutral-900/30 transition-colors border-b-neutral-900/50 group">
                            
                            {/* Participant Name & Ref */}
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-neutral-900 flex items-center justify-center text-neutral-400 border border-neutral-800">
                                  <Award className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="font-bold text-xs text-white leading-none mb-1">
                                    {cert.participant?.contact?.firstName ?? 'Participant'} {cert.participant?.contact?.lastName ?? ''}
                                  </p>
                                  <p className="text-[9px] text-neutral-500 font-mono">
                                    {cert.participant?.registrationRef ?? 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </TableCell>

                            {/* Status Badge */}
                            <TableCell className="py-4">
                              {getStatusBadge(cert.status)}
                            </TableCell>

                            {/* Timestamp */}
                            <TableCell className="text-xs text-neutral-400 py-4 font-mono">
                              {cert.generatedAt ? format(new Date(cert.generatedAt), 'MMM dd, HH:mm') : '--'}
                            </TableCell>

                            {/* Actions dropdown */}
                            <TableCell className="text-right py-4">
                              <div className="flex items-center justify-end gap-1.5">
                                {cert.fileUrl ? (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg hover:bg-neutral-900 hover:text-white cursor-pointer"
                                    asChild
                                  >
                                    <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer">
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </Button>
                                ) : cert.status === 'FAILED' ? (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg hover:bg-neutral-900 text-amber-500 cursor-pointer"
                                    onClick={() => retryMutation.mutate(cert.id)}
                                    disabled={retryMutation.isPending}
                                  >
                                    <RefreshCcw className="h-3.5 w-3.5" />
                                  </Button>
                                ) : null}

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg cursor-pointer">
                                      <Settings2 className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48 rounded-xl border-neutral-900 bg-neutral-950 text-neutral-200">
                                    {cert.fileUrl && (
                                      <DropdownMenuItem 
                                        onClick={() => window.open(`/quiz/${contestId}/certificate/${cert.id}`)}
                                        className="cursor-pointer gap-2"
                                      >
                                        <ExternalLink className="h-4 w-4" /> View Public Page
                                      </DropdownMenuItem>
                                    )}
                                    {cert.status === 'FAILED' && (
                                      <DropdownMenuItem 
                                        onClick={() => retryMutation.mutate(cert.id)}
                                        className="cursor-pointer gap-2"
                                      >
                                        <RefreshCcw className="h-4 w-4" /> Retry Generation
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
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-neutral-500">
                    Showing <span className="text-neutral-300 font-bold">{certificates.length}</span> of <span className="text-neutral-300 font-bold">{pagination.total}</span> entries
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl h-9 px-4 border-neutral-800 bg-neutral-900/40 text-xs"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl h-9 px-4 border-neutral-800 bg-neutral-900/40 text-xs"
                      onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

            </div>

          </div>
        </>
      ) : (
        /* Designer Template Configurator split-screen */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Configurator Controls */}
          <Card className="bg-neutral-950/40 border-neutral-900 rounded-3xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-amber-500" /> Certificate Configurator
              </h3>
              <p className="text-xs text-neutral-400">
                Design the visual template that Puppeteer uses to render credentials. Changes apply dynamically to all generated PDFs.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-neutral-400">Certificate Title text</span>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Certificate of Accomplishment"
                  className="h-11 rounded-xl bg-neutral-950 border-neutral-800 text-sm focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-neutral-400">Signature Author Name</span>
                <Input
                  value={sigName}
                  onChange={(e) => setSigName(e.target.value)}
                  placeholder="Contest Director"
                  className="h-11 rounded-xl bg-neutral-950 border-neutral-800 text-sm focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-neutral-400">Signature Title</span>
                <Input
                  value={sigTitle}
                  onChange={(e) => setSigTitle(e.target.value)}
                  placeholder="Lead Evaluator"
                  className="h-11 rounded-xl bg-neutral-950 border-neutral-800 text-sm focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-neutral-400">Theme Stylesheet Preview</span>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'royal', label: 'Royal Gold', style: 'border-amber-500/30 text-amber-500' },
                    { id: 'midnight', label: 'Midnight Blue', style: 'border-blue-500/30 text-blue-400' },
                    { id: 'emerald', label: 'Emerald Merit', style: 'border-emerald-500/30 text-emerald-400' }
                  ].map((themeBtn) => (
                    <button
                      key={themeBtn.id}
                      onClick={() => setPreviewTheme(themeBtn.id as CertificateTheme)}
                      className={cn(
                        "h-10 rounded-xl border text-xs font-semibold cursor-pointer transition-all",
                        previewTheme === themeBtn.id
                          ? "bg-neutral-800 border-neutral-600 text-white"
                          : "bg-neutral-950 border-neutral-900 text-neutral-500"
                      )}
                    >
                      {themeBtn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-900">
              <Button 
                onClick={() => toast.success('Certificate layout saved successfully')}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/10"
              >
                Save Layout Configuration
              </Button>
            </div>
          </Card>

          {/* Live Mock Preview Canvas */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" /> Live Canvas Render Mockup
              </h4>
              <span className="text-[10px] text-neutral-500 italic">Preformatted for 8.5" x 11" aspect ratio</span>
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
