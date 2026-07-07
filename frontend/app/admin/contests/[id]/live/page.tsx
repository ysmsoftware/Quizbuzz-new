'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Users,
  MessageSquare,
  Gamepad2,
  AlertTriangle,
  Activity,
  Search,
  MoreVertical,
  Ban,
  UserX,
  ShieldAlert,
  Loader2,
  Clock,
  CheckCircle2,
  DoorOpen,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAdminContestSocket } from '@/lib/hooks/useAdminContestSocket';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { cn } from '@/lib/utils';
import { getContest, getParticipant } from '@/lib/api/contests.api';
import { SendMessageModal } from '@/components/features/messaging/SendMessageModal';
import { ParticipantDrawer } from '@/components/features/registrations/ParticipantDrawer';
import { normalizeRegistration } from '@/lib/hooks/useRegistrations';
import { deriveContestPhase } from '@/lib/utils/contest';
import type { Registration, ServerContest } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Waiting room',
  active: 'In quiz',
  submitted: 'Submitted',
  disconnected: 'Disconnected',
  flagged: 'Disqualified',
};

export default function AdminLiveDashboard() {
  const { id: contestId } = useParams() as { id: string };
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { admin, activeOrg } = useAuth();
  const [contest, setContest] = useState<ServerContest | null>(null);
  const [timeLeftStr, setTimeLeftStr] = useState<string>('Loading timer...');

  // Participant drawer state
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingParticipant, setIsLoadingParticipant] = useState(false);

  // Messaging modal state
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageModalParticipantIds, setMessageModalParticipantIds] = useState<string[]>([]);

  useEffect(() => {
    getContest(contestId).then((res) => {
      if (res.success && res.data) {
        setContest(res.data);
      }
    });
  }, [contestId]);

  useEffect(() => {
    if (!contest) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(contest.startTime).getTime();
      const end = new Date(contest.endTime).getTime();

      if (now < start) {
        const diff = start - now;
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeftStr(`Starts in ${hrs > 0 ? hrs + 'h ' : ''}${mins}m ${secs}s`);
      } else if (now < end) {
        const diff = end - now;
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeftStr(`Ends in ${hrs > 0 ? hrs + 'h ' : ''}${mins}m ${secs}s`);
      } else {
        setTimeLeftStr('Contest Ended');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [contest]);

  const {
    connected,
    participants,
    violations,
    stats,
    sendBroadcast,
    forceSubmitParticipant,
  } = useAdminContestSocket(
    contestId,
    admin?.id ?? '',
    activeOrg?.id,
    undefined,
    (data) => {
      if (data.isFlagged) {
        toast.error(`CRITICAL: ${data.name} flagged for proctoring violations`, {
          duration: 10000,
        });
      }
    },
  );

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'progress' | 'answered' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearchQuery, sortField, sortOrder, pageSize]);

  const filteredParticipants = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.participantId.toLowerCase().includes(q),
    );
  }, [participants, debouncedSearchQuery]);

  const STATUS_PRIORITY: Record<string, number> = {
    flagged: 1,
    active: 2,
    waiting: 3,
    submitted: 4,
    disconnected: 5,
  };

  const sortedParticipants = useMemo(() => {
    const sorted = [...filteredParticipants];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'progress') {
        const aProg = a.totalQuestions > 0 ? a.answeredCount / a.totalQuestions : 0;
        const bProg = b.totalQuestions > 0 ? b.answeredCount / b.totalQuestions : 0;
        comparison = aProg - bProg;
      } else if (sortField === 'answered') {
        comparison = a.answeredCount - b.answeredCount;
      } else if (sortField === 'status') {
        const aPriority = STATUS_PRIORITY[a.status] ?? 99;
        const bPriority = STATUS_PRIORITY[b.status] ?? 99;
        comparison = aPriority - bPriority;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredParticipants, sortField, sortOrder]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.ceil(sortedParticipants.length / pageSize);
  }, [sortedParticipants.length, pageSize]);

  const paginatedParticipants = useMemo(() => {
    if (pageSize === 'all') {
      return sortedParticipants;
    }
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return sortedParticipants.slice(start, end);
  }, [sortedParticipants, pageIndex, pageSize]);

  const handleSort = (field: 'name' | 'progress' | 'answered' | 'status') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'progress' || field === 'answered' ? 'desc' : 'asc');
    }
  };

  const handleViewDetails = async (participantId: string) => {
    setIsDrawerOpen(true);
    setSelectedRegistration(null);
    setIsLoadingParticipant(true);
    try {
      const res = await getParticipant(contestId, participantId);
      if (res.success && res.data) {
        setSelectedRegistration(normalizeRegistration(res.data));
      } else {
        toast.error('Failed to load participant details.');
        setIsDrawerOpen(false);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load participant details.');
      setIsDrawerOpen(false);
    } finally {
      setIsLoadingParticipant(false);
    }
  };

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = paginatedParticipants.length > 50;

  const rowVirtualizer = useVirtualizer({
    count: paginatedParticipants.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 58,
    overscan: 10,
    enabled: shouldVirtualize,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - virtualRows[virtualRows.length - 1].end
      : 0;
  const renderParticipantRow = (p: any) => {
    const progress = p.totalQuestions > 0 ? (p.answeredCount / p.totalQuestions) * 100 : 0;
    return (
      <TableRow
        key={p.participantId}
        className={cn(
          'hover:bg-secondary/20 transition-colors',
          p.isFlagged && 'bg-destructive/5 hover:bg-destructive/10',
        )}
      >
        <TableCell>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs">
              {p.avatarInitials || p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm leading-none mb-1">
                {p.name}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {p.participantId}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell className="w-48">
          <div className="space-y-1.5">
            <Progress value={progress} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground font-bold">
              {Math.round(progress)}% complete
            </p>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="font-mono text-xs">
            {p.answeredCount} / {p.totalQuestions || '—'}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge
            className={cn(
              'capitalize font-bold text-[10px] px-2 py-0.5',
              p.status === 'active' &&
                'bg-green-500/10 text-green-500 border-green-500/20',
              p.status === 'waiting' &&
                'bg-amber-500/10 text-amber-500 border-amber-500/20',
              p.status === 'submitted' &&
                'bg-blue-500/10 text-blue-500 border-blue-500/20',
              p.status === 'flagged' &&
                'bg-destructive/10 text-destructive border-destructive/20',
            )}
          >
            {STATUS_LABEL[p.status] ?? p.status}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-xl border-border/50"
            >
              <DropdownMenuItem
                onClick={() => handleViewDetails(p.participantId)}
              >
                <Search className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-amber-500"
                onClick={() => forceSubmitParticipant(p.participantId)}
              >
                <UserX className="h-4 w-4 mr-2" />
                Force Submit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  };

  if (!connected) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">
          Connecting to live monitoring server...
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Live Monitor</h1>
            <Badge
              variant="outline"
              className="bg-green-500/10 text-green-500 border-green-500/20 px-3 py-1 gap-1.5 font-bold uppercase tracking-wider text-[10px]"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </Badge>
            {contest && (
              <Badge
                variant="outline"
                className={cn(
                  "px-3 py-1 gap-1.5 font-mono font-bold text-[11px] border-border/50 rounded-lg",
                  timeLeftStr.startsWith("Ends") ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"
                )}
              >
                <Clock className="h-3 w-3 animate-pulse" />
                {timeLeftStr}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Real-time WebSocket feed — contest{' '}
            <span className="font-mono text-xs">{contestId}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="rounded-xl h-11 px-6 border-border/50 hover:bg-secondary/50"
            onClick={() => {
              const msg = window.prompt('Enter message for all participants:');
              if (msg) sendBroadcast(msg, 'info', 'all');
            }}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Broadcast Message
          </Button>
          <Button
            variant="outline"
            className="rounded-xl h-11 px-6"
            onClick={() => router.push(`/admin/contests/${contestId}/proctoring`)}
          >
            <Activity className="h-4 w-4 mr-2" />
            Proctoring Review
          </Button>
        </div>
      </div>

      <WidgetErrorBoundary name="Live Activity Overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Waiting room"
            value={stats.inWaitingRoom}
            icon={DoorOpen}
            color="amber"
          />
          <StatCard
            label="In quiz"
            value={stats.activeNow}
            icon={Gamepad2}
            color="primary"
          />
          <StatCard
            label="Submitted"
            value={stats.submitted}
            icon={CheckCircle2}
            color="green"
          />
          <StatCard
            label="Disconnected"
            value={0}
            icon={Clock}
            color="amber"
          />
          <StatCard
            label="Flagged"
            value={stats.flagged}
            icon={ShieldAlert}
            color="destructive"
          />
        </div>
      </WidgetErrorBoundary>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <WidgetErrorBoundary name="Participant Progress Table">
          <div className="xl:col-span-2 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Participants ({sortedParticipants.length === participants.length ? participants.length : `${sortedParticipants.length}/${participants.length}`})
              </h2>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search participants..."
                  className="pl-10 h-10 rounded-xl bg-secondary/30 border-border/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <Card className="bg-background/50 border-border/50 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div
                ref={tableContainerRef}
                className="overflow-y-auto w-full max-h-[600px] relative scrollbar-thin scrollbar-thumb-secondary"
              >
                <Table className="relative">
                  <TableHeader className="bg-secondary/50 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.1)]">
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead
                        className="font-bold cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1.5 py-2">
                          Participant
                          {sortField === 'name' ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-75" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="font-bold cursor-pointer select-none hover:text-foreground transition-colors w-48"
                        onClick={() => handleSort('progress')}
                      >
                        <div className="flex items-center gap-1.5 py-2">
                          Progress
                          {sortField === 'progress' ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-75" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="font-bold cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSort('answered')}
                      >
                        <div className="flex items-center gap-1.5 py-2">
                          Answered
                          {sortField === 'answered' ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-75" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead
                        className="font-bold cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1.5 py-2">
                          Status
                          {sortField === 'status' ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-75" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-right py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedParticipants.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-24 text-center text-muted-foreground italic"
                        >
                          No participants connected yet.
                        </TableCell>
                      </TableRow>
                    ) : shouldVirtualize ? (
                      <>
                        {paddingTop > 0 && (
                          <TableRow style={{ height: `${paddingTop}px` }} className="hover:bg-transparent">
                            <TableCell colSpan={5} className="p-0 border-0" />
                          </TableRow>
                        )}
                        {virtualRows.map((virtualRow) => {
                          const p = paginatedParticipants[virtualRow.index];
                          if (!p) return null;
                          return renderParticipantRow(p);
                        })}
                        {paddingBottom > 0 && (
                          <TableRow style={{ height: `${paddingBottom}px` }} className="hover:bg-transparent">
                            <TableCell colSpan={5} className="p-0 border-0" />
                          </TableRow>
                        )}
                      </>
                    ) : (
                      paginatedParticipants.map((p) => renderParticipantRow(p))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/50 bg-secondary/15">
                <div className="text-xs text-muted-foreground font-medium">
                  {pageSize === 'all' ? (
                    `Showing all ${sortedParticipants.length} participants`
                  ) : (
                    <>
                      Showing{' '}
                      <span className="font-semibold text-foreground">
                        {sortedParticipants.length === 0 ? 0 : pageIndex * pageSize + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-semibold text-foreground">
                        {Math.min((pageIndex + 1) * pageSize, sortedParticipants.length)}
                      </span>{' '}
                      of{' '}
                      <span className="font-semibold text-foreground">
                        {sortedParticipants.length}
                      </span>{' '}
                      participants
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Rows per page
                    </span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(val) => {
                        if (val === 'all') {
                          setPageSize('all');
                        } else {
                          setPageSize(Number(val));
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-[80px] rounded-lg bg-background border-border/50 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/50">
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {pageSize !== 'all' && totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg bg-background border-border/50"
                        onClick={() => setPageIndex(0)}
                        disabled={pageIndex === 0}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg bg-background border-border/50"
                        onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                        disabled={pageIndex === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-semibold px-2">
                        Page {pageIndex + 1} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg bg-background border-border/50"
                        onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={pageIndex >= totalPages - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg bg-background border-border/50"
                        onClick={() => setPageIndex(totalPages - 1)}
                        disabled={pageIndex >= totalPages - 1}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </WidgetErrorBoundary>

        <WidgetErrorBoundary name="Violation Feed Monitor">
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Violation Feed
              {stats.totalViolations > 0 && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {stats.totalViolations} total
                </Badge>
              )}
            </h2>

            <Card className="bg-background/50 border-border/50 rounded-2xl h-[calc(100vh-400px)] flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence initial={false}>
                  {violations.map((v) => (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        'p-4 rounded-xl border flex items-start gap-3',
                        v.severity >= 3
                          ? 'bg-destructive/5 border-destructive/20'
                          : 'bg-secondary/30 border-border/50',
                      )}
                    >
                      <div
                        className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                          v.severity >= 3 ? 'bg-destructive/10' : 'bg-amber-500/10',
                        )}
                      >
                        {v.severity >= 3 ? (
                          <Ban className="h-4 w-4 text-destructive" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-sm truncate">{v.name}</p>
                          <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                            {new Date(v.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Violation:{' '}
                          <span className="text-foreground font-bold">
                            {v.type.replace(/_/g, ' ')}
                          </span>
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {violations.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="h-12 w-12 rounded-full bg-secondary/50 flex items-center justify-center">
                      <ShieldAlert className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      No violations detected yet.
                    </p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-border/50 bg-secondary/20">
                <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest font-bold">
                  Real-time monitoring active
                </p>
              </div>
            </Card>
          </div>
        </WidgetErrorBoundary>
      </div>
    </div>

      {/* PARTICIPANT DETAIL DRAWER */}
      <ParticipantDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedRegistration(null);
        }}
        registration={selectedRegistration}
        contest={contest}
        phase={contest ? deriveContestPhase(contest) : 'LIVE'}
        isLoading={isLoadingParticipant}
        onMarkAsPaid={() => {}}
        onAllowFree={() => {}}
        onRevoke={(reason) => {
          if (selectedRegistration) {
            toast.info(`Revoke requested for ${selectedRegistration.participantDetails?.fullName}. Use the Registrations tab to confirm.`);
          }
        }}
        onSendMessage={(id) => {
          setMessageModalParticipantIds([id]);
          setIsMessageModalOpen(true);
        }}
      />

      <SendMessageModal
        open={isMessageModalOpen}
        onOpenChange={setIsMessageModalOpen}
        contestId={contestId}
        selectedParticipantIds={messageModalParticipantIds}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'primary' | 'green' | 'amber' | 'destructive';
}) {
  const styles = {
    primary: {
      card: 'hover:border-primary/30',
      icon: 'bg-primary/10 text-primary',
    },
    green: {
      card: 'hover:border-green-500/30',
      icon: 'bg-green-500/10 text-green-500',
    },
    amber: {
      card: 'hover:border-amber-500/30',
      icon: 'bg-amber-500/10 text-amber-500',
    },
    destructive: {
      card: 'hover:border-destructive/30',
      icon: 'bg-destructive/10 text-destructive',
    },
  }[color];

  return (
    <Card
      className={cn(
        'bg-secondary/20 border-border/50 rounded-2xl overflow-hidden group transition-all',
        styles.card,
      )}
    >
      <CardContent className="p-6 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {label}
          </p>
          <p
            className={cn(
              'text-3xl font-extrabold',
              color === 'destructive' && 'text-destructive',
            )}
          >
            {value}
          </p>
        </div>
        <div
          className={cn(
            'h-12 w-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform',
            styles.icon,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  );
}
