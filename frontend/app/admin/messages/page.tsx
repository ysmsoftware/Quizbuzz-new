'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Mail, 
  MessageSquare, 
  Search, 
  Filter, 
  RefreshCcw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Send,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Zap,
  Smartphone,
  Layout,
  AlertCircle,
  Plus
} from 'lucide-react';
import { crmApi, MessageRecord } from '@/lib/api/crm.api';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function MessagingLogsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [contestId, setContestId] = useState<string>(''); // In a real scenario, this might come from context or filter

  // Queries
  // For the global log, we might need a different endpoint, but using contest-specific as per rule for now.
  // Assuming if contestId is empty, it might fetch all or we use a fallback ID for demonstration.
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', contestId, { page, channel, status }],
    queryFn: () => crmApi.getContestMessages(contestId || 'all', { 
      channel: channel === 'all' ? undefined : channel,
      status: status === 'all' ? undefined : status,
      page, 
      limit: 20 
    }),
    enabled: true,
  });

  // Mutations
  const retryMutation = useMutation({
    mutationFn: (msgId: string) => crmApi.retryMessage(msgId),
    onSuccess: () => {
      toast.success('Message re-queued for delivery');
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to retry message');
    },
  });

  const messages = messagesData?.data?.data || [];
  const pagination = messagesData?.data?.pagination;
  const summary = messagesData?.data?.summary;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 gap-1.5"><CheckCircle2 className="h-3 w-3" /> Delivered</Badge>;
      case 'SENT':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1.5"><Send className="h-3 w-3" /> Sent</Badge>;
      case 'FAILED':
        return <Badge variant="destructive" className="gap-1.5"><XCircle className="h-3 w-3" /> Failed</Badge>;
      case 'PROCESSING':
        return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1.5"><RefreshCcw className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case 'QUEUED':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1.5"><Clock className="h-3 w-3" /> Queued</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getChannelIcon = (channel: string) => {
    return channel === 'WHATSAPP' ? <Smartphone className="h-4 w-4" /> : <Mail className="h-4 w-4" />;
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Messaging Center</h1>
          <p className="text-muted-foreground">Monitor delivery status and broadcast manual announcements.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl h-11 border-border/50">
            <Layout className="h-4 w-4 mr-2" />
            Manage Templates
          </Button>
          <Button className="rounded-xl h-11 bg-primary shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4 mr-2" />
            Broadcast Message
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <WidgetErrorBoundary name="Messaging Summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-secondary/20 border-border/50 rounded-2xl">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Delivered</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-black">{summary?.sent || 0}</p>
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl">
            <CardContent className="p-6">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Failed Delivery</p>
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
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Pending Queue</p>
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
                <span className="text-xs font-black uppercase tracking-widest">Live Logs</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                Tracking communications for contest ID: <span className="font-mono">{contestId || 'ALL'}</span>. Real-time updates via Webhooks.
              </p>
            </CardContent>
          </Card>
        </div>
      </WidgetErrorBoundary>

      {/* Filters */}
      <Card className="p-2 rounded-2xl border-border/50 bg-secondary/10 flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by recipient or name..." 
            className="pl-10 h-10 border-none bg-transparent focus-visible:ring-0"
          />
        </div>
        <div className="h-10 w-[1px] bg-border/50 hidden md:block" />
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-full md:w-40 h-10 border-none bg-transparent focus:ring-0">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/50">
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="EMAIL">Email</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <div className="h-10 w-[1px] bg-border/50 hidden md:block" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full md:w-40 h-10 border-none bg-transparent focus:ring-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/50">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="QUEUED">Queued</SelectItem>
          </SelectContent>
        </Select>
        <Button className="h-10 rounded-xl px-6" onClick={() => queryClient.invalidateQueries({ queryKey: ['messages'] })}>
          Apply
        </Button>
      </Card>

      {/* Main Table */}
      <WidgetErrorBoundary name="Messaging Logs Table">
        <Card className="bg-background/50 border-border/50 rounded-[2rem] overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="font-bold h-14 pl-8">Recipient</TableHead>
                <TableHead className="font-bold">Channel & Template</TableHead>
                <TableHead className="font-bold">Delivery Status</TableHead>
                <TableHead className="font-bold">Time</TableHead>
                <TableHead className="font-bold text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={5} className="h-16 bg-secondary/10" />
                  </TableRow>
                ))
              ) : messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">
                    <div className="flex flex-col items-center gap-3">
                      <MessageSquare className="h-10 w-10 opacity-20" />
                      No messages found.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                messages.map((msg) => (
                  <TableRow key={msg.id} className="hover:bg-secondary/20 transition-colors group border-border/20">
                    <TableCell className="pl-8">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm leading-none mb-1">
                            {msg.participant.contact.firstName} {msg.participant.contact.lastName}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {msg.recipient}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-primary">
                          {getChannelIcon(msg.channel)}
                          {msg.channel}
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{msg.template}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getStatusBadge(msg.status)}
                        {msg.retryCount > 0 && (
                          <p className="text-[9px] text-muted-foreground font-bold">Retried {msg.retryCount} times</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-xs font-medium">{msg.sentAt ? format(new Date(msg.sentAt), 'MMM dd, HH:mm') : '--'}</p>
                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Last Updated</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50">
                          <DropdownMenuItem>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Log Detail
                          </DropdownMenuItem>
                          {msg.status === 'FAILED' && (
                            <DropdownMenuItem onClick={() => retryMutation.mutate(msg.id)}>
                              <RefreshCcw className="h-4 w-4 mr-2" />
                              Retry Message
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-primary">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat with Recipient
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </WidgetErrorBoundary>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground font-medium">
            Showing <span className="text-foreground">{messages.length}</span> of <span className="text-foreground">{pagination.total}</span> logs
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
  );
}

function User({ className }: { className?: string }) {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
