'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useContestMessages } from '@/lib/hooks/useContestMessages';
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
import { useRouter } from 'next/navigation';
import { useContests } from '@/lib/hooks/useContests';
import { useContacts } from '@/lib/hooks/useContacts';
import { useMessageDetail } from '@/lib/hooks/useMessageDetail';
import { SendMessageModal } from '@/components/features/messaging/SendMessageModal';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Trophy } from 'lucide-react';

export default function MessagingLogsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [channel, setChannel] = useState<string>('all');
    const [status, setStatus] = useState<string>('all');
    const [contestId, setContestId] = useState<string>(''); // In a real scenario, this might come from context or filter

    // Broadcast Compose Dialog states
    const [isContestSelectOpen, setIsContestSelectOpen] = useState(false);
    const [selectedBroadcastContestId, setSelectedBroadcastContestId] = useState<string | null>(null);
    const [isSendMessageOpen, setIsSendMessageOpen] = useState(false);
    // Direct message states
    const [isDirectSelectOpen, setIsDirectSelectOpen] = useState(false);
    const [directSearch, setDirectSearch] = useState('');
    const [selectedDirectContactId, setSelectedDirectContactId] = useState<string | null>(null);
    const [isSendDirectOpen, setIsSendDirectOpen] = useState(false);

    // Message detail dialog state
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [isMessageDetailOpen, setIsMessageDetailOpen] = useState(false);

    const { data: messageDetailData, isLoading: isMessageDetailLoading } = useMessageDetail(
      selectedMessageId && isMessageDetailOpen ? selectedMessageId : null
    );

    // Fetch contests list for broadcast selection targeting
    const { contests: contestsList = [], isLoading: isContestsLoading } = useContests();

    // Queries
    // For the global log, we might need a different endpoint, but using contest-specific as per rule for now.
    // Assuming if contestId is empty, it might fetch all or we use a fallback ID for demonstration.
    const {
      messages,
      pagination,
      summary,
      isLoading: isMessagesLoading,
      retryMessage,
    } = useContestMessages(contestId || 'all', {
      channel: channel === 'all' ? undefined : channel,
      status: status === 'all' ? undefined : status,
      page,
      limit: 20,
    });

    // Contacts search for direct messaging
    const { contacts: contactsSearchData, isLoading: isContactsSearching } = useContacts(
      { search: directSearch, limit: 10 },
      { enabled: directSearch.trim().length > 0 }
    );

    // Mutations
    const retryMutation = useMutation({
      mutationFn: (msgId: string) => retryMessage(msgId),
      onSuccess: () => {
        toast.success('Message re-queued for delivery');
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to retry message');
      },
    });

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
                    <Button
                        variant="outline"
                        className="rounded-xl h-11 border-border/50"
                        onClick={() => router.push('/admin/messages/templates')}
                    >
                        <Layout className="h-4 w-4 mr-2" />
                        Manage Templates
                    </Button>
                    <Button
                        className="rounded-xl h-11 bg-primary shadow-lg shadow-primary/20"
                        onClick={() => setIsContestSelectOpen(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Broadcast Message
                    </Button>
                    <Button
                        variant="outline"
                        className="rounded-xl h-11 border-border/50"
                        onClick={() => setIsDirectSelectOpen(true)}
                    >
                        <Mail className="h-4 w-4 mr-2" />
                        Send Direct Message
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
                <div className="h-10 w-px bg-border/50 hidden md:block" />
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
                <div className="h-10 w-px bg-border/50 hidden md:block" />
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
                <Card className="bg-background/50 border-border/50 rounded-4xl overflow-hidden shadow-sm">
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
                            {isMessagesLoading ? (
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
                                                        {msg.contact ? `${msg.contact.firstName} ${msg.contact.lastName ?? ''}` : 'Broadcast Recipient'}
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
                                                    <DropdownMenuItem onClick={() => { setSelectedMessageId(msg.id); setIsMessageDetailOpen(true); }}>
                                                        <ExternalLink className="h-4 w-4 mr-2" />
                                                        View Log Detail
                                                    </DropdownMenuItem>
                                                    {msg.status === 'FAILED' && (
                                                        <DropdownMenuItem onClick={() => retryMutation.mutate(msg.id)}>
                                                            <RefreshCcw className="h-4 w-4 mr-2" />
                                                            Retry Message
                                                        </DropdownMenuItem>
                                                    )}
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

            {/* Contest Selection Dialog */}
            {/* Direct Contact Selection Dialog */}
            <Dialog open={isDirectSelectOpen} onOpenChange={setIsDirectSelectOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto p-6 border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl">
                    <DialogHeader className="pb-4 border-b border-border/40">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Mail className="h-5 w-5 text-primary" />
                            Send Direct Message
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground mt-1">
                            Search and select a contact by name, email, or phone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search name, email or phone..."
                                className="pl-10 h-10"
                                value={directSearch}
                                onChange={(e) => setDirectSearch(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                            {isContactsSearching ? (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCcw className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : directSearch.trim().length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground italic py-6">Type to search contacts.</p>
                            ) : contactsSearchData.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground italic py-6">No contacts found.</p>
                            ) : (
                                contactsSearchData.map((c) => (
                                    <Button
                                        key={c.id}
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedDirectContactId(c.id);
                                            setIsDirectSelectOpen(false);
                                            setIsSendDirectOpen(true);
                                        }}
                                        className="w-full h-auto p-4 flex justify-between items-center rounded-xl text-left border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all"
                                    >
                                        <div className="space-y-0.5">
                                            <p className="font-bold text-sm text-foreground">{c.firstName} {c.lastName}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-mono">{c.email} {c.phone ? `• ${c.phone}` : ''}</p>
                                        </div>
                                        <Badge variant="secondary" className="bg-secondary/60 text-foreground">Select</Badge>
                                    </Button>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={isContestSelectOpen} onOpenChange={setIsContestSelectOpen}>
                <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto p-6 border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl">
                    <DialogHeader className="pb-4 border-b border-border/40">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-primary" />
                            Select Contest for Broadcast
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground mt-1">
                            Select which contest's registered participants you want to send a broadcast message to.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-3">
                        {isContestsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <RefreshCcw className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : contestsList.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground italic py-6">
                                No active contests found. Please create a contest first.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-2.5 max-h-[40vh] overflow-y-auto pr-1">
                                {contestsList.map((contest: any) => (
                                    <Button
                                        key={contest.id}
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedBroadcastContestId(contest.id);
                                            setIsContestSelectOpen(false);
                                            setIsSendMessageOpen(true);
                                        }}
                                        className="w-full h-auto p-4 flex justify-between items-center rounded-xl text-left border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all group"
                                    >
                                        <div className="space-y-1">
                                            <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                                                {contest.title}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">
                                                Status: <span className="text-foreground">{contest.status}</span>
                                            </p>
                                        </div>
                                        <Badge variant="secondary" className="bg-secondary/60 text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                            Select
                                        </Badge>
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Message Detail Dialog */}
            <Dialog open={isMessageDetailOpen} onOpenChange={(v) => { if (!v) { setIsMessageDetailOpen(false); setSelectedMessageId(null); } else setIsMessageDetailOpen(v); }}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto p-6 border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl">
                    <DialogHeader className="pb-4 border-b border-border/40">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <ExternalLink className="h-5 w-5 text-primary" />
                            Message Detail
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {isMessageDetailLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <RefreshCcw className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : !messageDetailData?.data ? (
                            <p className="text-sm text-muted-foreground">No details available.</p>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm"><strong>Recipient:</strong> {messageDetailData.data.recipient}</p>
                                <p className="text-sm"><strong>Channel:</strong> {messageDetailData.data.channel}</p>
                                <p className="text-sm"><strong>Status:</strong> {messageDetailData.data.status}</p>
                                <p className="text-sm"><strong>Template:</strong> {messageDetailData.data.template}</p>
                                <div className="pt-2">
                                    <p className="text-sm font-semibold">Body</p>
                                    <pre className="whitespace-pre-wrap text-sm bg-muted/5 p-3 rounded-lg">{messageDetailData.data.body}</pre>
                                </div>
                                {messageDetailData.data.parameters && (
                                    <div>
                                        <p className="text-sm font-semibold">Parameters</p>
                                        <pre className="whitespace-pre-wrap text-sm bg-muted/5 p-3 rounded-lg">{JSON.stringify(messageDetailData.data.parameters, null, 2)}</pre>
                                    </div>
                                )}
                                {messageDetailData.data.contact && (
                                    <div>
                                        <p className="text-sm font-semibold">Contact</p>
                                        <p className="text-sm">{messageDetailData.data.contact.firstName} {messageDetailData.data.contact.lastName}</p>
                                        <p className="text-sm text-muted-foreground">{messageDetailData.data.contact.email} {messageDetailData.data.contact.phone ? `• ${messageDetailData.data.contact.phone}` : ''}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Send Message Modal */}
            {selectedBroadcastContestId && (
                <SendMessageModal
                    open={isSendMessageOpen}
                    onOpenChange={setIsSendMessageOpen}
                    contestId={selectedBroadcastContestId}
                />
            )}
            {/* Direct Send Message Modal */}
            {selectedDirectContactId && (
                <SendMessageModal
                    open={isSendDirectOpen}
                    onOpenChange={setIsSendDirectOpen}
                    contestId={''}
                    contactId={selectedDirectContactId}
                />
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
