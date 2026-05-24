'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { cn } from '@/lib/utils';

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

  const filteredParticipants = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return participants.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.participantId.toLowerCase().includes(q),
    );
  }, [participants, searchQuery]);

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
                Participants ({participants.length})
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

            <Card className="bg-background/50 border-border/50 rounded-2xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold">Participant</TableHead>
                    <TableHead className="font-bold">Progress</TableHead>
                    <TableHead className="font-bold">Answered</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-muted-foreground italic"
                      >
                        No participants connected yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredParticipants.map((p) => {
                      const progress =
                        p.totalQuestions > 0
                          ? (p.answeredCount / p.totalQuestions) * 100
                          : 0;
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
                                {p.avatarInitials}
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
                                  onClick={() =>
                                    router.push(
                                      `/admin/contests/${contestId}/participants/${p.participantId}`,
                                    )
                                  }
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
                    })
                  )}
                </TableBody>
              </Table>
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
