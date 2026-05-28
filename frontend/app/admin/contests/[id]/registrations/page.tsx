'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Search,
    Filter,
    Download,
    MessageSquare,
    MoreHorizontal,
    CheckCircle2,
    Clock,
    XCircle,
    ShieldAlert,
    Calendar as CalendarIcon,
    Copy,
    ChevronDown,
    ArrowUpRight,
    TrendingUp,
    CreditCard,
    User,
    Mail,
    Phone,
    MapPin,
    ExternalLink,
    MessageCircle,
    X,
    Loader2,
    Trash2,
    ShieldCheck,
    ChevronRight,
    RefreshCw,
    AlertTriangle,
    FileText,
    Camera,
    Eye,
    Layers,
    Maximize,
    Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

import { useContestDetail } from '@/lib/hooks/useContestDetail';
import { useRegistrations } from '@/lib/hooks/useRegistrations';
import { useContestSubmissions } from '@/lib/hooks/useSubmissions';
import { deriveContestPhase } from '@/lib/utils/contest';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetClose,
    SheetFooter,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn, isValidDate, toDateOrNull } from '@/lib/utils';
import { Registration, RegistrationStatus } from '@/lib/types';
import { toast } from 'sonner';
import { SendMessageModal } from '@/components/features/messaging/SendMessageModal';
import { exportToCSV, exportToPDF } from '@/lib/utils/export-utils';
import { DateRangePicker } from '@/components/ui/date-range-picker';

export default function RegistrationsTabPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { data: contest } = useContestDetail(id);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
    const [paymentFilter, setPaymentFilter] = useState<'all' | string>('all');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isPaymentsExpanded, setIsPaymentsExpanded] = useState(false);

    // Date range filter and export states
    const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');

    // Message modal state
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [messageModalParticipantIds, setMessageModalParticipantIds] = useState<string[]>([]);

    const filters = useMemo(() => ({
        search: searchQuery,
        status: statusFilter === 'all' ? undefined : statusFilter,
        payment: paymentFilter === 'all' ? undefined : paymentFilter,
        limit: 1000, // Fetch up to 1000 participant registrations for seamless client virtualization and local exporting
    }), [searchQuery, statusFilter, paymentFilter]);

    const {
        data: registrations,
        isLoading,
        revokeRegistrations,
        markAsPaid,
        allowFreeEntry,
        bulkUpdateStatus,
        statusSummary
    } = useRegistrations(id, filters);

    // Client-side filtration by Date Range
    const filteredRegistrations = useMemo(() => {
        if (!registrations) return [];
        return registrations.filter((reg: Registration) => {
            if (!dateRange) return true;
            if (!reg.registeredAt) return false;

            const regDate = new Date(reg.registeredAt);
            const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null;
            const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : null;

            if (startDate && regDate < startDate) return false;
            if (endDate && regDate > endDate) return false;
            return true;
        });
    }, [registrations, dateRange]);

    const phase = useMemo(() => {
        if (!contest) return 'DRAFT';
        return deriveContestPhase(contest);
    }, [contest]);

    const stats = useMemo(() => {
        if (!contest || !registrations) return null;
        const fee = contest.fee || 0;

        // Calculate stats using the active filtered list for maximum context feedback
        const confirmedCount = registrations.filter((r: Registration) => r.status === 'confirmed').length;
        const paidCount = registrations.filter((r: Registration) => r.paymentStatus === 'completed').length;
        const pendingCount = registrations.filter((r: Registration) => r.paymentStatus === 'pending').length;
        const failedCount = registrations.filter((r: Registration) => r.paymentStatus === 'failed').length;
        const freeCount = registrations.filter((r: Registration) => !r.amount || r.amount === 0).length;

        return {
            total: contest?._count?.participants || 0,
            confirmed: confirmedCount || contest?._count?.participants || 0,
            paid: paidCount || contest?._count?.payments || 0,
            pending: pendingCount,
            failed: failedCount,
            free: freeCount,
            submitted: contest?._count?.submissions || 0,
            revenue: registrations.reduce((sum: number, r: Registration) => sum + (r.paymentStatus === 'completed' ? (r.amount || fee) : 0), 0)
        };
    }, [contest, registrations]);

    const handleExport = (format: 'csv' | 'pdf') => {
        const dataset = exportScope === 'filtered' ? filteredRegistrations : (registrations || []);
        if (dataset.length === 0) {
            toast.error("No registrations matching scope to export");
            return;
        }

        try {
            if (format === 'csv') {
                exportToCSV({ contestTitle: contest?.title || 'Contest', registrations: dataset });
                toast.success("CSV file downloaded successfully!");
            } else {
                exportToPDF({ contestTitle: contest?.title || 'Contest', registrations: dataset });
                toast.success("PDF Print dialog triggered!");
            }
            setIsExportModalOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to trigger export");
        }
    };

    // Virtualizer setup using client-filtered registrations
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredRegistrations?.length || 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 72,
        overscan: 10,
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse font-medium">Fetching registrations...</p>
            </div>
        );
    }

    const handleRowClick = (reg: Registration) => {
        setSelectedRegistration(reg);
        setIsDrawerOpen(true);
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`, { duration: 2000 });
    };

    // Virtualized table sizing and layout helpers
    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;
    const hasQuizStatus = phase !== 'DRAFT' && phase !== 'PUBLISHED' && phase !== 'REGISTRATION_CLOSED';
    const totalColSpan = hasQuizStatus ? 9 : 8;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* TOP STATS STRIP */}
            <WidgetErrorBoundary name="Registration Summary Stats">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <StatChip label="Total" value={stats?.total || 0} color="neutral" />
                    <StatChip label="Confirmed" value={stats?.confirmed || 0} color="green" />

                    {contest?.fee && contest.fee > 0 ? (
                        <>
                            <StatChip label="Paid" value={stats?.paid || 0} color="green" />
                            <StatChip label="Pending" value={stats?.pending || 0} color="amber" />
                            <StatChip label="Failed" value={stats?.failed || 0} color="red" />
                        </>
                    ) : (
                        <StatChip label="Free Contest" value={stats?.free || 0} color="blue" />
                    )}

                    {(phase === 'ENDED' || phase === 'RESULTS_PUBLISHED') && (
                        <StatChip label="Submitted" value={stats?.submitted || 0} color="blue" />
                    )}

                    {contest?.fee && contest.fee > 0 && (
                        <div className="col-span-2 md:col-span-1 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex flex-col justify-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 opacity-70">Revenue Collected</span>
                            <span className="text-2xl font-black text-green-600 dark:text-green-400">₹{stats?.revenue.toLocaleString()}</span>
                        </div>
                    )}
                </div>
            </WidgetErrorBoundary>

            {/* FILTER + SEARCH BAR */}
            <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email, phone, ID..."
                        className="pl-9 bg-muted/30"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 whitespace-nowrap">
                                Status: {
                                    statusFilter === 'all' ? 'All' :
                                        statusFilter === 'REGISTERED' ? 'Registered' :
                                            statusFilter === 'CHECKED_IN' ? 'Checked In' :
                                                statusFilter === 'SUBMITTED' ? 'Submitted' :
                                                    statusFilter === 'ABSENT' ? 'Absent' :
                                                        statusFilter === 'DISQUALIFIED' ? 'Disqualified' : statusFilter
                                }
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                                All ({stats?.total || 0})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('REGISTERED')}>
                                Registered ({statusSummary?.REGISTERED ?? 0})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('CHECKED_IN')}>
                                Checked In ({statusSummary?.CHECKED_IN ?? 0})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('IN_WAITING')}>
                                In Waiting Room ({statusSummary?.IN_WAITING ?? 0})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('IN_QUIZ')}>
                                Actively Answering ({statusSummary?.IN_QUIZ ?? 0})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('SUBMITTED')}>
                                Submitted ({statusSummary?.SUBMITTED ?? 0})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('ABSENT')}>
                                Absent ({statusSummary?.ABSENT ?? 0})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatusFilter('DISQUALIFIED')}>
                                Disqualified ({statusSummary?.DISQUALIFIED ?? 0})
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {contest?.fee && contest.fee > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 whitespace-nowrap">
                                    Payment: {paymentFilter}
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => setPaymentFilter('all')}>All</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPaymentFilter('completed')}>Paid</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPaymentFilter('pending')}>Pending</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPaymentFilter('failed')}>Failed</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    <DateRangePicker
                        value={dateRange}
                        onChange={setDateRange}
                        label="Date"
                    />

                    <Button variant="outline" size="sm" className="h-9" onClick={() => setIsExportModalOpen(true)}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>

                    <Button
                        className="bg-primary text-primary-foreground h-9"
                        onClick={() => {
                            setMessageModalParticipantIds([]);
                            setIsMessageModalOpen(true);
                        }}
                    >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Send Message
                    </Button>
                </div>
            </div>

            {/* REGISTRATIONS TABLE */}
            <WidgetErrorBoundary name="Registrations Table">
                <Card className="border-border/50 overflow-hidden bg-card">
                    <div ref={parentRef} className="h-[600px] overflow-auto relative">
                        <table className="w-full text-sm border-collapse table-fixed min-w-[1000px]">
                            <colgroup>
                                <col style={{ width: '48px' }} />
                                <col style={{ width: '135px' }} />
                                <col style={{ width: '220px' }} />
                                <col style={{ width: '220px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '110px' }} />
                                {phase !== 'DRAFT' && phase !== 'PUBLISHED' && phase !== 'REGISTRATION_CLOSED' && (
                                    <col style={{ width: '140px' }} />
                                )}
                                <col style={{ width: '220px' }} />
                                <col style={{ width: '48px' }} />
                            </colgroup>
                            <thead>
                                <tr className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest border-b border-border/40">
                                    <th className="w-12 px-4 py-3 bg-muted sticky top-0 z-10 text-center shadow-[inset_0_-1px_0_rgba(var(--border))]">
                                        <Checkbox
                                            checked={selectedIds.length === (filteredRegistrations?.length || 0) && (filteredRegistrations?.length || 0) > 0}
                                            onCheckedChange={(checked) => {
                                                if (checked) setSelectedIds(filteredRegistrations?.map((r: Registration) => r.id) || []);
                                                else setSelectedIds([]);
                                            }}
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left bg-muted sticky top-0 z-10 shadow-[inset_0_-1px_0_rgba(var(--border))]">Registration Ref</th>
                                    <th className="px-4 py-3 text-left bg-muted sticky top-0 z-10 shadow-[inset_0_-1px_0_rgba(var(--border))]">Name</th>
                                    <th className="px-4 py-3 text-left bg-muted sticky top-0 z-10 shadow-[inset_0_-1px_0_rgba(var(--border))]">Contact</th>
                                    <th className="px-4 py-3 text-center bg-muted sticky top-0 z-10 shadow-[inset_0_-1px_0_rgba(var(--border))]">Payment</th>
                                    <th className="px-4 py-3 text-center bg-muted sticky top-0 z-10 shadow-[inset_0_-1px_0_rgba(var(--border))]">Reg Status</th>
                                    {phase !== 'DRAFT' && phase !== 'PUBLISHED' && phase !== 'REGISTRATION_CLOSED' && (
                                        <th className="px-4 py-3 text-center bg-muted sticky top-0 z-10 shadow-[inset_0_-1px_0_rgba(var(--border))]">Quiz Status</th>
                                    )}
                                    <th className="px-4 py-3 text-left bg-muted sticky top-0 z-10 shadow-[inset_0_-1px_0_rgba(var(--border))]">Custom Fields</th>
                                    <th className="w-12 px-4 py-3 text-right bg-muted sticky top-0 z-10 shadow-[inset_0_-1px_0_rgba(var(--border))]"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {!filteredRegistrations || filteredRegistrations.length === 0 ? (
                                    <tr>
                                        <td colSpan={totalColSpan} className="py-24 text-center">
                                            <div className="flex flex-col items-center justify-center max-w-md mx-auto gap-4">
                                                <div className="h-16 w-16 rounded-full bg-muted/40 flex items-center justify-center border border-border/40">
                                                    <Search className="h-6 w-6 text-muted-foreground/50 animate-pulse" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className="text-lg font-black tracking-tight text-foreground">No registrations found</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        No participants match the search query "{searchQuery}" or selected filters.
                                                    </p>
                                                </div>
                                                {(searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || dateRange) && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="mt-2 text-xs font-bold uppercase tracking-wider hover:bg-muted"
                                                        onClick={() => {
                                                            setSearchQuery('');
                                                            setStatusFilter('all');
                                                            setPaymentFilter('all');
                                                            setDateRange(null);
                                                        }}
                                                    >
                                                        Reset Filters
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {paddingTop > 0 && (
                                            <tr>
                                                <td colSpan={totalColSpan} style={{ height: `${paddingTop}px` }} />
                                            </tr>
                                        )}
                                        {virtualItems.map((virtualRow) => {
                                            const reg = filteredRegistrations[virtualRow.index];
                                            if (!reg) return null;
                                            return (
                                                <tr
                                                    key={reg.id}
                                                    className={cn(
                                                        "group border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer",
                                                        selectedIds.includes(reg.id) && "bg-primary/5"
                                                    )}
                                                    style={{
                                                        height: `${virtualRow.size}px`,
                                                    }}
                                                    onClick={() => handleRowClick(reg)}
                                                >
                                                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={selectedIds.includes(reg.id)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) setSelectedIds(prev => [...prev, reg.id]);
                                                                else setSelectedIds(prev => prev.filter(id => id !== reg.id));
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <button
                                                            className="font-mono text-xs font-bold hover:text-primary transition-colors block w-full text-left truncate"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                copyToClipboard(reg.registrationRef, 'Registration Ref');
                                                            }}
                                                        >
                                                            {reg.registrationRef}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8 rounded-full border border-border/50 shrink-0">
                                                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-black">
                                                                    {((reg.participantDetails?.fullName || 'Participant').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2))}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-bold truncate block w-full">{reg.participantDetails?.fullName || 'Participant'}</span>
                                                                <span className="text-[10px] text-muted-foreground truncate">{isValidDate(reg.registeredAt) ? formatDistanceToNow(new Date(reg.registeredAt)) + ' ago' : '—'}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col text-xs min-w-0">
                                                            <span className="truncate block w-full">{reg.participantDetails?.email || '—'}</span>
                                                            <span className="text-muted-foreground text-[10px] truncate">{reg.participantDetails?.phone || '—'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            {(!contest?.fee || contest.fee === 0) ? (
                                                                <Badge variant="secondary" className="text-[10px] font-bold uppercase bg-green-500/10 text-green-700 border-green-500/20">
                                                                    Confirmed
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant={
                                                                    reg.paymentStatus === 'completed' ? 'secondary' :
                                                                        reg.paymentStatus === 'pending' ? 'outline' : 'destructive'
                                                                } className={cn(
                                                                    "text-[10px] font-bold uppercase",
                                                                    reg.paymentStatus === 'completed' && "bg-green-500/10 text-green-700 border-green-500/20",
                                                                    reg.paymentStatus === 'pending' && "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                                                )}>
                                                                    {reg.paymentStatus === 'completed' ? 'Paid' : reg.paymentStatus === 'pending' ? 'Pending' : 'Failed'}
                                                                </Badge>
                                                            )}
                                                            {contest?.fee && contest.fee > 0 && reg.amount && <span className="text-[10px] font-medium text-muted-foreground">₹{reg.amount}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <Badge className={cn(
                                                            "text-[10px] font-bold uppercase",
                                                            reg.status === 'confirmed' ? "bg-green-500 text-white" :
                                                                reg.status === 'pending' ? "bg-amber-500 text-white" :
                                                                    reg.status === 'revoked' ? "bg-muted text-muted-foreground" : "bg-destructive text-white"
                                                        )}>
                                                            {reg.status}
                                                        </Badge>
                                                    </td>
                                                    {phase !== 'DRAFT' && phase !== 'PUBLISHED' && phase !== 'REGISTRATION_CLOSED' && (
                                                        <td className="px-4 py-4 text-center">
                                                            <QuizStatusBadge status={reg.quizStatus || 'not_joined'} progress={reg.currentQuestionIndex} total={reg.totalQuestions} />
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-4">
                                                        <div className="text-xs text-muted-foreground truncate block w-full">
                                                            {reg.participantDetails.institution || '—'}
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleRowClick(reg)}>View Full Details</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => {
                                                                    setMessageModalParticipantIds([reg.id]);
                                                                    setIsMessageModalOpen(true);
                                                                }}>Send WhatsApp</DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => {
                                                                    setMessageModalParticipantIds([reg.id]);
                                                                    setIsMessageModalOpen(true);
                                                                }}>Send Email</DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                {reg.status !== 'revoked' && (
                                                                    <DropdownMenuItem
                                                                        className="text-destructive"
                                                                        onClick={() => {
                                                                            if (confirm("Revoking will prevent this participant from entering the quiz. Continue?")) {
                                                                                revokeRegistrations({ ids: [reg.id], reason: 'Manual admin revoke' });
                                                                            }
                                                                        }}
                                                                    >
                                                                        Revoke Registration
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {paddingBottom > 0 && (
                                            <tr>
                                                <td colSpan={totalColSpan} style={{ height: `${paddingBottom}px` }} />
                                            </tr>
                                        )}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </WidgetErrorBoundary>

            {/* BULK ACTIONS BAR */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-6 py-3 bg-foreground text-background rounded-2xl shadow-2xl"
                    >
                        <div className="flex items-center gap-2 pr-6 border-r border-background/20">
                            <span className="text-sm font-black">{selectedIds.length}</span>
                            <span className="text-xs font-medium text-background/60">selected</span>
                            <button
                                className="text-[10px] font-bold uppercase tracking-wider text-primary underline underline-offset-4 ml-2"
                                onClick={() => setSelectedIds([])}
                            >
                                Deselect
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-background hover:bg-background/10 h-8 text-xs"
                                onClick={() => {
                                    setMessageModalParticipantIds(selectedIds);
                                    setIsMessageModalOpen(true);
                                }}
                            >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Message
                            </Button>
                            <Button variant="ghost" size="sm" className="text-background hover:bg-background/10 h-8 text-xs">
                                <Download className="mr-2 h-4 w-4" />
                                Export
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-background hover:bg-background/10 h-8 text-xs"
                                onClick={async () => {
                                    if (confirm(`Reset status of ${selectedIds.length} participants back to Registered?`)) {
                                        await bulkUpdateStatus({ ids: selectedIds, status: 'REGISTERED' });
                                        setSelectedIds([]);
                                    }
                                }}
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reset to Registered
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:bg-red-400/10 h-8 text-xs font-bold"
                                onClick={async () => {
                                    if (confirm(`Disqualify ${selectedIds.length} participants?`)) {
                                        await bulkUpdateStatus({ ids: selectedIds, status: 'DISQUALIFIED' });
                                        setSelectedIds([]);
                                    }
                                }}
                            >
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Disqualify
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:bg-red-400/10 h-8 text-xs"
                                onClick={() => {
                                    const reason = prompt("Enter reason for revoking:");
                                    if (reason) revokeRegistrations({ ids: selectedIds, reason });
                                }}
                            >
                                Revoke Selected
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PAYMENT SUMMARY GRID */}
            {contest?.fee && contest.fee > 0 && (
                <WidgetErrorBoundary name="Payment Summary">
                    <CollapsibleSection title="Payment Summary" expanded={isPaymentsExpanded} onToggle={() => setIsPaymentsExpanded(!isPaymentsExpanded)}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <PaymentCard
                                label="Collected"
                                value={`₹${stats?.revenue.toLocaleString()}`}
                                subtitle={`from ${stats?.paid} payments`}
                                trend="+₹1,450 today"
                            />
                            <PaymentCard
                                label="Pending"
                                value={`₹${(stats?.pending || 0) * contest.fee}`}
                                subtitle={`${stats?.pending} payments pending`}
                                note="Participants can still complete payment"
                                action={{ label: "Send Reminder", onClick: () => toast.success("Reminders sent!") }}
                                color="amber"
                            />
                            <PaymentCard
                                label="Failed"
                                value={`₹${(stats?.failed || 0) * contest.fee} missed`}
                                subtitle={`${stats?.failed} failed payments`}
                                action={{ label: "Review Failed", onClick: () => setStatusFilter('failed') }}
                                color="red"
                            />
                        </div>

                        <div className="mt-8 h-30 w-full bg-muted/20 rounded-xl p-4 border border-border/50">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Registration Revenue Trend</span>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { day: 'Mon', revenue: 1200 },
                                    { day: 'Tue', revenue: 1900 },
                                    { day: 'Wed', revenue: 1500 },
                                    { day: 'Thu', revenue: 2400 },
                                    { day: 'Fri', revenue: 3200 },
                                    { day: 'Sat', revenue: 2800 },
                                    { day: 'Sun', revenue: 3500 },
                                ]}>
                                    <Bar dataKey="revenue" radius={[2, 2, 0, 0]}>
                                        {Array.from({ length: 7 }).map((_, i) => (
                                            <Cell key={i} fill={i === 6 ? 'var(--primary)' : 'var(--primary-opacity-20, rgba(var(--primary-rgb), 0.2))'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CollapsibleSection>
                </WidgetErrorBoundary>
            )}

            {/* PARTICIPANT DETAIL DRAWER */}
            <ParticipantDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                registration={selectedRegistration}
                contest={contest}
                phase={phase}
                onMarkAsPaid={(ref) => markAsPaid({ id: selectedRegistration!.id, reference: ref })}
                onAllowFree={() => allowFreeEntry(selectedRegistration!.id)}
                onRevoke={(reason) => revokeRegistrations({ ids: [selectedRegistration!.id], reason })}
                onSendMessage={(participantId) => {
                    setMessageModalParticipantIds([participantId]);
                    setIsMessageModalOpen(true);
                }}
            />

            <SendMessageModal
                open={isMessageModalOpen}
                onOpenChange={setIsMessageModalOpen}
                contestId={id}
                selectedParticipantIds={messageModalParticipantIds}
            />

            {/* HIGH-FIDELITY EXPORT CONFIGURATION MODAL */}
            <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
                <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border border-border/50 rounded-3xl p-6 shadow-2xl">
                    <DialogHeader className="space-y-2">
                        <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                                <Download className="h-5 w-5" />
                            </div>
                            Export Registrations
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Configure your data exports below. Select the scope of participants you want to compile and choose your preferred file format.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 my-4">
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Export Scope</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    className={cn(
                                        "p-4 rounded-2xl border text-left flex flex-col justify-between h-28 transition-all hover:bg-muted/40",
                                        exportScope === 'filtered'
                                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary"
                                            : "border-border/50 bg-background/40"
                                    )}
                                    onClick={() => setExportScope('filtered')}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <Filter className={cn("h-4 w-4", exportScope === 'filtered' ? "text-primary" : "text-muted-foreground")} />
                                        <div className={cn("h-2 w-2 rounded-full", exportScope === 'filtered' ? "bg-primary" : "bg-transparent")} />
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="font-bold text-xs block text-foreground">Filtered List</span>
                                        <span className="text-[10px] text-muted-foreground font-semibold">{filteredRegistrations.length} participants</span>
                                    </div>
                                </button>

                                <button
                                    className={cn(
                                        "p-4 rounded-2xl border text-left flex flex-col justify-between h-28 transition-all hover:bg-muted/40",
                                        exportScope === 'all'
                                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary"
                                            : "border-border/50 bg-background/40"
                                    )}
                                    onClick={() => setExportScope('all')}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className={cn("h-4 w-4", exportScope === 'all' ? "text-primary" : "text-muted-foreground")} />
                                        <div className={cn("h-2 w-2 rounded-full", exportScope === 'all' ? "bg-primary" : "bg-transparent")} />
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="font-bold text-xs block text-foreground">All Registrations</span>
                                        <span className="text-[10px] text-muted-foreground font-semibold">{registrations?.length || 0} participants</span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/40">
                        <Button
                            variant="outline"
                            className="rounded-xl font-bold uppercase tracking-wider text-xs h-11 border-border/80"
                            onClick={() => handleExport('csv')}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button
                            className="rounded-xl font-bold uppercase tracking-wider text-xs h-11 bg-primary text-primary-foreground"
                            onClick={() => handleExport('pdf')}
                        >
                            <FileText className="mr-2 h-4 w-4" />
                            Print PDF
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}

// ═══════════════════════════════════════════════════════
// UI Components
// ═══════════════════════════════════════════════════════

function StatChip({ label, value, color }: { label: string; value: number | string; color: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }) {
    const colorClasses = {
        neutral: "bg-muted text-muted-foreground border-border",
        green: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
        amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        red: "bg-destructive/10 text-destructive border-destructive/20",
        blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
    };

    return (
        <div className={cn("px-4 py-3 rounded-2xl border flex flex-col gap-0.5", colorClasses[color])}>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</span>
            <span className="text-xl font-black">{value}</span>
        </div>
    );
}

function QuizStatusBadge({ status, progress, total }: { status: string; progress?: number; total?: number }) {
    const config = {
        // Raw values map
        REGISTERED: {
            label: 'Registered',
            className: 'bg-muted/60 text-muted-foreground border border-border/50 shadow-sm'
        },
        CHECKED_IN: {
            label: 'Checked In',
            className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm shadow-indigo-500/5'
        },
        IN_WAITING: {
            label: 'In Waiting Room',
            className: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shadow-sm shadow-cyan-500/5 animate-pulse'
        },
        IN_QUIZ: {
            label: progress && total ? `Answering (Q${progress}/${total})` : 'In Quiz',
            className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/35 shadow-md shadow-emerald-500/5 font-black',
            dot: true,
            dotColor: 'bg-emerald-500'
        },
        SUBMITTED: {
            label: 'Submitted',
            className: 'bg-emerald-600 text-white dark:bg-emerald-500 border border-emerald-500/20 shadow-md shadow-emerald-500/10 font-bold'
        },
        ABSENT: {
            label: 'Absent',
            className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-500/5'
        },
        DISQUALIFIED: {
            label: 'Disqualified',
            className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/35 shadow-md shadow-rose-500/5 font-black uppercase tracking-wider'
        },

        // Legacy/fallback values map
        not_joined: {
            label: 'Not joined',
            className: 'bg-muted/60 text-muted-foreground border border-border/50 shadow-sm'
        },
        waiting: {
            label: 'In waiting room',
            className: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shadow-sm'
        },
        answering: {
            label: progress && total ? `Answering (Q${progress}/${total})` : 'Answering',
            className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/35 shadow-md shadow-emerald-500/5 font-black',
            dot: true,
            dotColor: 'bg-emerald-500'
        },
        submitted: {
            label: 'Submitted',
            className: 'bg-emerald-600 text-white dark:bg-emerald-500 border border-emerald-500/20 shadow-md shadow-emerald-500/10 font-bold'
        },
        absent: {
            label: 'Did not attempt',
            className: 'bg-muted/60 text-muted-foreground border border-border/50 shadow-sm'
        }
    }[status] || { label: status, className: 'bg-muted text-muted-foreground' };

    return (
        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider", config.className)}>
            {config.dot && (
                <span className="relative flex h-2 w-2">
                    <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", config.dotColor || 'bg-primary')}></span>
                    <span className={cn("relative inline-flex rounded-full h-2 w-2", config.dotColor || 'bg-primary')}></span>
                </span>
            )}
            {config.label}
        </div>
    );
}

function CollapsibleSection({ title, children, expanded, onToggle }: { title: string; children: React.ReactNode; expanded: boolean; onToggle: () => void }) {
    return (
        <div className="border border-border/50 rounded-2xl overflow-hidden bg-muted/10">
            <button
                className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                onClick={onToggle}
            >
                <span className="text-sm font-black uppercase tracking-widest">{title}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", expanded && "rotate-180")} />
            </button>
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-6 border-t border-border/40">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function PaymentCard({ label, value, subtitle, trend, note, action, color = 'neutral' }: {
    label: string;
    value: string;
    subtitle: string;
    trend?: string;
    note?: string;
    action?: { label: string; onClick: () => void };
    color?: 'neutral' | 'amber' | 'red';
}) {
    return (
        <Card className="border-border/50 bg-background/50">
            <CardContent className="p-6 space-y-4">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                    <div className="flex items-baseline gap-3">
                        <span className={cn(
                            "text-3xl font-black",
                            color === 'amber' && "text-amber-600 dark:text-amber-400",
                            color === 'red' && "text-destructive"
                        )}>{value}</span>
                        {trend && <span className="text-xs font-bold text-green-500">{trend}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{subtitle}</span>
                </div>

                {note && <p className="text-[10px] text-muted-foreground/70 italic">Note: {note}</p>}

                {action && (
                    <Button variant="outline" size="sm" className="w-full h-8 text-[10px] font-bold uppercase tracking-wider" onClick={action.onClick}>
                        {action.label}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

function ParticipantDrawer({
    isOpen,
    onClose,
    registration,
    contest,
    phase,
    onMarkAsPaid,
    onAllowFree,
    onRevoke,
    onSendMessage
}: {
    isOpen: boolean;
    onClose: () => void;
    registration: Registration | null;
    contest: any;
    phase: string;
    onMarkAsPaid: (ref: string) => void;
    onAllowFree: () => void;
    onRevoke: (reason: string) => void;
    onSendMessage: (participantId: string) => void;
}) {
    if (!registration) return null;

    const registeredAtDate = toDateOrNull(registration.registeredAt);
    const joinedAtDate = toDateOrNull(registration.joinedAt);
    const lastActivityDate = toDateOrNull(registration.lastActivityAt);

    return (
        <>
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:max-w-120 p-0 flex flex-col">
                <SheetHeader className="p-6 pb-0 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 border-2 border-primary/20 p-0.5">
                                <AvatarFallback className="text-xl font-black bg-primary/10 text-primary uppercase">
                                    {((registration.participantDetails?.fullName || 'Participant').split(' ').map((n: string) => n[0]).join('').slice(0, 2))}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <h3 className="text-xl font-black tracking-tight">{registration.participantDetails?.fullName || 'Participant'}</h3>
                                <Badge variant="outline" className={cn(
                                    "w-fit text-[10px] uppercase mt-1",
                                    registration.status === 'confirmed' ? "border-green-500 text-green-600" : "border-amber-500 text-amber-600"
                                )}>
                                    {registration.status}
                                </Badge>
                            </div>
                        </div>
                        <SheetClose asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <X className="h-5 w-5" />
                            </Button>
                        </SheetClose>
                    </div>

                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-9 bg-muted/50 p-1">
                            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                            <TabsTrigger value="payment" className="text-xs">Payment</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-auto mt-6 space-y-8 pb-20 px-1">
                            <TabsContent value="overview" className="space-y-8 m-0">
                                <DetailSection title="Contact Information" icon={<User className="h-4 w-4" />}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <DetailItem label="Full Name" value={registration.participantDetails?.fullName || 'Participant'} />
                                        <DetailItem label="Email" value={registration.participantDetails?.email || '—'} copyable />
                                        <DetailItem label="Phone" value={registration.participantDetails?.phone || '—'} copyable />
                                        <DetailItem label="City/State" value={`${registration.participantDetails?.city || '—'}, ${registration.participantDetails?.state || '—'}`} />
                                    </div>
                                </DetailSection>

                                <DetailSection title="Registration Details" icon={<CalendarIcon className="h-4 w-4" />}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <DetailItem label="Registration Ref" value={registration.registrationRef} mono copyable />
                                        <DetailItem label="Participant ID" value={registration.participantId} mono copyable />
                                        <DetailItem label="Registered At" value={registeredAtDate ? format(registeredAtDate, 'PPP p') : '—'} />
                                        <DetailItem label="WhatsApp Opt-in" value={registration.whatsappOptIn ? 'Yes' : 'No'} />
                                    </div>
                                </DetailSection>

                                <DetailSection title="Custom Fields" icon={<Filter className="h-4 w-4" />}>
                                    <div className="grid grid-cols-1 gap-4">
                                        <DetailItem label="College/Institution" value={registration.participantDetails.institution || '—'} />
                                        {Object.entries(registration.customFields || {}).map(([key, value]) => (
                                            <DetailItem key={key} label={key} value={value} />
                                        ))}
                                    </div>
                                </DetailSection>

                                {(phase === 'REGISTRATION_CLOSED' || phase === 'LIVE') && (
                                    <DetailSection title="Contest Join Link" icon={<ExternalLink className="h-4 w-4" />}>
                                        <div className="p-3 bg-muted/30 rounded-xl border border-border/50 flex items-center justify-between gap-3">
                                            <span className="text-xs truncate font-mono text-muted-foreground">
                                                quizBuzz.pro/quiz/{contest.orgSlug}/{contest.slug}/enter
                                            </span>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => toast.success("Link copied!")}>
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </DetailSection>
                                )}
                            </TabsContent>

                            <TabsContent value="payment" className="space-y-8 m-0">
                                <div className="flex flex-col items-center justify-center py-6 bg-primary/5 rounded-2xl border border-primary/10">
                                    <Badge className={cn(
                                        "mb-3 uppercase text-[10px] text-white",
                                        (!contest?.fee || contest.fee === 0 || registration.paymentStatus === 'completed') ? "bg-green-500" : "bg-amber-500"
                                    )}>
                                        {(!contest?.fee || contest.fee === 0) ? 'Confirmed' : registration.paymentStatus}
                                    </Badge>
                                    <span className="text-4xl font-black">{(!contest?.fee || contest.fee === 0) ? 'Free' : `₹${registration.amount || contest.fee}`}</span>
                                    {contest?.fee && contest.fee > 0 && <span className="text-xs text-muted-foreground mt-1">Payment Method: {registration.paymentMethod || 'Razorpay'}</span>}
                                </div>

                                {contest?.fee && contest.fee > 0 && (
                                    <>
                                        <DetailSection title="Transaction History" icon={<CreditCard className="h-4 w-4" />}>
                                            <div className="space-y-4">
                                                <DetailItem label="Payment ID" value={registration.paymentId || '—'} mono copyable />
                                                <DetailItem label="Transaction Date" value={registration.paymentId && registeredAtDate ? format(registeredAtDate, 'PPP p') : '—'} />
                                            </div>
                                        </DetailSection>

                                        {registration.paymentStatus === 'failed' && (
                                            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-4">
                                                <div className="flex items-center gap-3 text-destructive">
                                                    <ShieldAlert className="h-5 w-5" />
                                                    <span className="text-sm font-bold">Reason: Payment declined by bank</span>
                                                </div>
                                                <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={onAllowFree}>
                                                    Allow Free Entry
                                                </Button>
                                            </div>
                                        )}

                                        {registration.paymentStatus === 'pending' && (
                                            <Button className="w-full" onClick={() => {
                                                const ref = prompt("Enter reference (Cash/Cheque ID):");
                                                if (ref) onMarkAsPaid(ref);
                                            }}>
                                                Mark as Manually Paid
                                            </Button>
                                        )}
                                    </>
                                )}
                            </TabsContent>

                        </div>
                    </Tabs>
                </SheetHeader>

                <SheetFooter className="mt-auto p-6 border-t bg-muted/5 grid grid-cols-2 gap-3">
                    <Button
                        className="bg-[#25D366] hover:bg-[#20ba5a] text-white"
                        onClick={() => {
                            if (registration) onSendMessage(registration.id);
                        }}
                    >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        WhatsApp
                    </Button>
                    <Button
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => {
                            if (registration) onSendMessage(registration.id);
                        }}
                    >
                        <Mail className="mr-2 h-4 w-4" />
                        Email
                    </Button>
                    <Button
                        variant="ghost"
                        className="col-span-2 text-destructive hover:bg-destructive/5"
                        onClick={() => {
                            const reason = prompt("Reason for revoking:");
                            if (reason) onRevoke(reason);
                        }}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Revoke Registration
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
        </>
    );
}

function DetailSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
            </div>
            {children}
        </div>
    );
}

function DetailItem({ label, value, mono, copyable }: { label: string; value: React.ReactNode; mono?: boolean; copyable?: boolean }) {
    return (
        <div className="flex flex-col gap-0.5 group">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{label}</span>
            <div className="flex items-center gap-2">
                <span className={cn(
                    "text-sm font-medium",
                    mono && "font-mono"
                )}>{value}</span>
                {copyable && typeof value === 'string' && (
                    <button
                        className="p-1 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                            navigator.clipboard.writeText(value);
                            toast.success(`${label} copied!`);
                        }}
                    >
                        <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                )}
            </div>
        </div>
    );
}
