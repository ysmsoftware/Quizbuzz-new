'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Users,
  Send,
  Gamepad2,
  AlertTriangle, 
  Activity, 
  Search, 
  MoreVertical,
  Ban,
  UserX,
  MessageSquare,
  ShieldAlert,
  Loader2,
  Clock,
  CheckCircle2,
  Trophy,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminSocket } from '@/lib/hooks/useAdminSocket';
import { useAuth } from '@/lib/hooks/useAuth';
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
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { cn } from '@/lib/utils';

export default function AdminLiveDashboard() {
  const { id: contestId } = useParams() as { id: string };
  const router = useRouter();

  // State
  const [liveState, setLiveState] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<any>(null);

  const { activeOrg } = useAuth();

  // Mocking token for now - in reality, it's in the cookie
  const accessToken = "placeholder-token"; 
  const organizationId = activeOrg?.id || "default-org";

  const { isConnected, startQuiz, broadcast, kickParticipant, banParticipant } = useAdminSocket({
    contestId,
    organizationId,
    accessToken,
    onSubscribed: (data) => {
      setLiveState(data);
      setParticipants(data.participants || []);
    },
    onParticipantJoined: (data) => {
      setParticipants(prev => {
        const exists = prev.find(p => p.participantId === data.participantId);
        if (exists) return prev;
        return [...prev, data];
      });
      toast.info(`${data.name} joined the quiz`);
    },
    onParticipantProgress: (data) => {
      setParticipants(prev => prev.map(p => 
        p.participantId === data.participantId 
          ? { ...p, ...data } 
          : p
      ));
    },
    onParticipantSubmitted: (data) => {
      setParticipants(prev => prev.map(p => 
        p.participantId === data.participantId 
          ? { ...p, status: 'SUBMITTED', ...data } 
          : p
      ));
      toast.success(`${data.name} submitted the quiz`);
    },
    onParticipantDisconnected: (data) => {
      setParticipants(prev => prev.map(p => 
        p.participantId === data.participantId 
          ? { ...p, status: 'DISCONNECTED' } 
          : p
      ));
    },
    onProctoringViolation: (data) => {
      setViolations(prev => [data, ...prev].slice(0, 50));
      setParticipants(prev => prev.map(p => 
        p.participantId === data.participantId 
          ? { ...p, violationCount: data.violationCount, trustScore: data.trustScore, isFlagged: data.isFlagged } 
          : p
      ));
    },
    onParticipantFlagged: (data) => {
      toast.error(`CRITICAL: ${data.name} has been flagged for violations!`, {
        duration: 10000,
      });
    },
    onLiveStats: (data) => {
      setStats(data);
    },
    onQuizEnded: (data) => {
      toast.success('The quiz has ended for all participants.');
    }
  });

  // Filtered Participants
  const filteredParticipants = useMemo(() => {
    return participants.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.participantId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [participants, searchQuery]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isConnected) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Connecting to live monitoring server...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header with Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Live Monitor</h1>
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 px-3 py-1 gap-1.5 font-bold uppercase tracking-wider text-[10px]">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </Badge>
          </div>
          <p className="text-muted-foreground">Contest ID: <span className="font-mono text-xs">{contestId}</span></p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="rounded-xl h-11 px-6 border-border/50 hover:bg-secondary/50" onClick={() => {
            const msg = window.prompt('Enter message for all participants:');
            if (msg) broadcast(msg);
          }}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Broadcast Message
          </Button>
          <Button className="rounded-xl h-11 px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
            <Activity className="h-4 w-4 mr-2" />
            Live Analytics
          </Button>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <WidgetErrorBoundary name="Live Activity Overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden group hover:border-primary/30 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">In Quiz</p>
                <p className="text-3xl font-extrabold">{stats?.totalInQuiz || '--'}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Gamepad2 className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden group hover:border-green-500/30 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Submitted</p>
                <p className="text-3xl font-extrabold">{stats?.totalSubmitted || '--'}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden group hover:border-amber-500/30 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Disconnected</p>
                <p className="text-3xl font-extrabold">{stats?.totalDisconnected || '--'}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden group hover:border-destructive/30 transition-all">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Flagged</p>
                <p className="text-3xl font-extrabold text-destructive">{stats?.totalFlagged || participants.filter(p => p.isFlagged).length}</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldAlert className="h-6 w-6 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>
      </WidgetErrorBoundary>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Participants Table */}
        <WidgetErrorBoundary name="Participant Progress Table">
          <div className="xl:col-span-2 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Participant Progress
              </h2>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search participants..." 
                  className="pl-10 h-10 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-all"
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
                  {filteredParticipants.map((p) => {
                    const progress = (p.answeredCount / (p.totalQuestions || 50)) * 100;
                    return (
                      <TableRow key={p.participantId} className={cn(
                        "hover:bg-secondary/20 transition-colors",
                        p.isFlagged && "bg-destructive/5 hover:bg-destructive/10"
                      )}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs">
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm leading-none mb-1">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{p.participantId}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="w-48">
                          <div className="space-y-1.5">
                            <Progress value={progress} className="h-1.5" />
                            <p className="text-[10px] text-muted-foreground font-bold">{Math.round(progress)}% Complete</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {p.answeredCount || 0} / {p.totalQuestions || '--'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "capitalize font-bold text-[10px] px-2 py-0.5",
                            p.status === 'IN_QUIZ' && "bg-green-500/10 text-green-500 border-green-500/20",
                            p.status === 'SUBMITTED' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                            p.status === 'DISCONNECTED' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                            p.status === 'DISQUALIFIED' && "bg-destructive/10 text-destructive border-destructive/20"
                          )}>
                            {p.status?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50">
                              <DropdownMenuItem onClick={() => router.push(`/admin/contests/${contestId}/participants/${p.participantId}`)}>
                                <Search className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-amber-500" onClick={() => kickParticipant(p.participantId)}>
                                <UserX className="h-4 w-4 mr-2" />
                                Kick Participant
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => {
                                const reason = window.prompt('Reason for disqualification:');
                                if (reason) banParticipant(p.participantId, reason);
                              }}>
                                <Ban className="h-4 w-4 mr-2" />
                                Ban / Disqualify
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        </WidgetErrorBoundary>

        {/* Live Violation Feed */}
        <WidgetErrorBoundary name="Violation Feed Monitor">
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Violation Feed
            </h2>

            <Card className="bg-background/50 border-border/50 rounded-2xl h-[calc(100vh-400px)] flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence initial={false}>
                  {violations.map((v, i) => (
                    <motion.div
                      key={`${v.participantId}-${i}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "p-4 rounded-xl border flex items-start gap-3 transition-colors",
                        v.severity >= 3 ? "bg-destructive/5 border-destructive/20" : "bg-secondary/30 border-border/50"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        v.severity >= 3 ? "bg-destructive/10" : "bg-amber-500/10"
                      )}>
                        {v.severity >= 3 ? <Ban className="h-4 w-4 text-destructive" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-sm truncate">{v.name}</p>
                          <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                            {new Date(v.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Violation: <span className="text-foreground font-bold">{v.type}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px] h-4 px-1">Trust: {Math.round(v.trustScore)}%</Badge>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">Total: {v.violationCount}</Badge>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {violations.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="h-12 w-12 rounded-full bg-secondary/50 flex items-center justify-center">
                      <ShieldAlert className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground italic">No violations detected yet.</p>
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

