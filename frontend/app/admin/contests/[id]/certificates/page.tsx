'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Award, 
  Download, 
  RefreshCcw, 
  Search, 
  Filter, 
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  Zap,
  ShieldCheck,
  AlertCircle,
  FileText
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

export default function CertificatesManagementPage() {
  const { id: contestId } = useParams() as { id: string };
  const queryClient = useQueryClient();

  // State
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Queries
  const { data: certsData, isLoading } = useQuery({
    queryKey: ['certificates', contestId, { page, status }],
    queryFn: () => certificatesApi.getContestCertificates(contestId, { 
      status: status === 'all' ? undefined : status, 
      page, 
      limit: 20 
    }),
  });

  // Mutations
  const bulkIssueMutation = useMutation({
    mutationFn: (cutoff?: number) => certificatesApi.bulkIssueCertificates(contestId, { cutoffPercentage: cutoff }),
    onSuccess: () => {
      toast.success('Bulk certificate generation queued');
      queryClient.invalidateQueries({ queryKey: ['certificates', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to bulk issue certificates');
    },
  });

  const retryMutation = useMutation({
    mutationFn: (certId: string) => certificatesApi.retryCertificate(certId),
    onSuccess: () => {
      toast.success('Generation retry queued');
      queryClient.invalidateQueries({ queryKey: ['certificates', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to retry generation');
    },
  });

  const certificates = certsData?.data?.data || [];
  const pagination = certsData?.data?.pagination;
  const summary = certsData?.data?.summary;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1.5"><CheckCircle2 className="h-3 w-3" /> Generated</Badge>;
      case 'FAILED':
        return <Badge variant="destructive" className="gap-1.5"><XCircle className="h-3 w-3" /> Failed</Badge>;
      case 'GENERATING':
        return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1.5"><RefreshCcw className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case 'QUEUED':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1.5"><Clock className="h-3 w-3" /> Queued</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleBulkIssue = () => {
    const cutoff = window.prompt('Enter minimum accuracy percentage for eligibility (leave blank for contest default):');
    const cutoffNum = cutoff ? parseInt(cutoff) : undefined;
    bulkIssueMutation.mutate(cutoffNum);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Certificates</h1>
          <p className="text-muted-foreground">Manage and issue recognition certificates to participants.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl h-11" onClick={() => queryClient.invalidateQueries({ queryKey: ['certificates'] })}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="rounded-xl h-11 bg-primary shadow-lg shadow-primary/20" onClick={handleBulkIssue}>
            <Send className="h-4 w-4 mr-2" />
            Bulk Issue
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-secondary/20 border-border/50 rounded-2xl">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Generated</p>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-black">{summary?.generated || 0}</p>
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-secondary/20 border-border/50 rounded-2xl">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Failed</p>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-black text-destructive">{summary?.failed || 0}</p>
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-secondary/20 border-border/50 rounded-2xl">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Pending/Queued</p>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-black">{summary?.pending || 0}</p>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border border-primary/10 rounded-2xl">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 text-primary">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-widest">Automation Active</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              Certificates are generated asynchronously using Puppeteer. Failures are automatically retried up to 3 times.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main List */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search participant name or ref..." 
                className="pl-10 h-10 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px] h-10 rounded-xl bg-secondary/30 border-border/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/50">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="GENERATED">Generated</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="QUEUED">Queued</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="bg-background/50 border-border/50 rounded-2xl overflow-hidden shadow-sm">
          <WidgetErrorBoundary name="Certificates Table">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold">Participant</TableHead>
                  <TableHead className="font-bold">Generation Status</TableHead>
                  <TableHead className="font-bold">Generated At</TableHead>
                  <TableHead className="font-bold">Delivery</TableHead>
                  <TableHead className="font-bold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell colSpan={5} className="h-16 bg-secondary/10" />
                    </TableRow>
                  ))
                ) : certificates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                      No certificates found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  certificates.map((cert) => (
                    <TableRow key={cert.id} className="hover:bg-secondary/20 transition-colors group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                            <Award className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-sm leading-none mb-1">
                              {cert.participant.contact.firstName} {cert.participant.contact.lastName}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {cert.participant.registrationRef}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(cert.status)}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {cert.generatedAt ? format(new Date(cert.generatedAt), 'MMM dd, HH:mm') : '--'}
                      </TableCell>
                      <TableCell>
                        {cert.deliveredAt ? (
                          <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/5 gap-1">
                            <ShieldCheck className="h-3 w-3" /> Sent
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Pending delivery</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {cert.fileUrl && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                              asChild
                            >
                              <a href={cert.fileUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50">
                              <DropdownMenuItem onClick={() => cert.fileUrl && window.open(cert.fileUrl)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Certificate
                              </DropdownMenuItem>
                              {cert.status === 'FAILED' && (
                                <DropdownMenuItem onClick={() => retryMutation.mutate(cert.id)}>
                                  <RefreshCcw className="h-4 w-4 mr-2" />
                                  Retry Generation
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive">
                                <XCircle className="h-4 w-4 mr-2" />
                                Revoke Access
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

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground font-medium">
              Showing <span className="text-foreground">{certificates.length}</span> of <span className="text-foreground">{pagination.total}</span> certificates
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-10 px-4 border-border/50"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-10 px-4 border-border/50"
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
