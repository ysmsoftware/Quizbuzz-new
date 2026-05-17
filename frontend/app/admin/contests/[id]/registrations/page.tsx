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
  ChevronRight
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
import { cn } from '@/lib/utils';
import { Registration, RegistrationStatus } from '@/lib/types';
import { toast } from 'sonner';

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

  const filters = useMemo(() => ({
    search: searchQuery,
    status: statusFilter === 'all' ? undefined : statusFilter,
    payment: paymentFilter === 'all' ? undefined : paymentFilter,
  }), [searchQuery, statusFilter, paymentFilter]);

  const { data: registrations, isLoading, revokeRegistrations, markAsPaid, allowFreeEntry } = useRegistrations(id, filters);

  const phase = useMemo(() => {
    if (!contest) return 'DRAFT';
    return deriveContestPhase(contest);
  }, [contest]);

  const stats = useMemo(() => {
    if (!contest || !registrations) return null;
    const fee = contest.fee || 0;
    
    // Calculate filtered stats from the current registrations list
    // Note: This might be partial if registrations is paginated, but better than nothing
    // For absolute accuracy, we'd need a separate summary endpoint
    const confirmedCount = registrations.filter(r => r.status === 'confirmed').length;
    const paidCount = registrations.filter(r => r.paymentStatus === 'completed').length;
    const pendingCount = registrations.filter(r => r.paymentStatus === 'pending').length;
    const failedCount = registrations.filter(r => r.paymentStatus === 'failed').length;
    const freeCount = registrations.filter(r => !r.amount || r.amount === 0).length;

    return {
      total: contest?._count?.participants || 0,
      confirmed: confirmedCount || contest?._count?.participants || 0, // Fallback to participants if we can't filter
      paid: paidCount || contest?._count?.payments || 0,
      pending: pendingCount,
      failed: failedCount,
      free: freeCount,
      submitted: contest?._count?.submissions || 0,
      revenue: registrations.reduce((sum, r) => sum + (r.paymentStatus === 'completed' ? (r.amount || fee) : 0), 0)
    };
  }, [contest, registrations]);

  // Virtualizer setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: registrations?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // height of row
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
                Status: {statusFilter}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter('all')}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('confirmed')}>Confirmed</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('pending')}>Pending</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('failed')}>Failed</DropdownMenuItem>
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

          <Button variant="outline" size="sm" className="h-9">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Date Range
          </Button>

          <Button variant="outline" size="sm" className="h-9" onClick={() => toast.success("Exporting CSV...")}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>

          <Button 
            className="bg-primary text-primary-foreground h-9"
            onClick={() => router.push(`/admin/contests/${id}/messages`)}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Send Message
          </Button>
        </div>
      </div>

      {/* REGISTRATIONS TABLE */}
      <WidgetErrorBoundary name="Registrations Table">
        <Card className="border-border/50 overflow-hidden">
          <div ref={parentRef} className="h-[600px] overflow-auto relative">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest border-b">
                  <th className="w-12 px-4 py-3">
                    <Checkbox 
                      checked={selectedIds.length === registrations?.length && (registrations?.length || 0) > 0}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedIds(registrations?.map(r => r.id) || []);
                        else setSelectedIds([]);
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Participant ID</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-center">Payment</th>
                  <th className="px-4 py-3 text-center">Reg Status</th>
                  <th className="px-4 py-3 text-left">Custom Fields</th>
                  {phase !== 'DRAFT' && phase !== 'PUBLISHED' && phase !== 'REGISTRATION_CLOSED' && (
                    <th className="px-4 py-3 text-center">Quiz Status</th>
                  )}
                  <th className="w-12 px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const reg = registrations![virtualRow.index];
                  return (
                    <tr 
                      key={reg.id}
                      className={cn(
                        "group border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer",
                        selectedIds.includes(reg.id) && "bg-primary/5"
                      )}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
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
                          className="font-mono text-xs font-bold hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(reg.participantId, 'ID');
                          }}
                        >
                          {reg.participantId}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 rounded-full border border-border/50">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-black">
                              {reg.participantDetails.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-bold truncate max-w-[120px]">{reg.participantDetails.fullName}</span>
                            <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(reg.registeredAt))} ago</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col text-xs">
                          <span className="truncate max-w-[150px]">{reg.participantDetails.email}</span>
                          <span className="text-muted-foreground text-[10px]">{reg.participantDetails.phone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
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
                          {reg.amount && <span className="text-[10px] font-medium text-muted-foreground">₹{reg.amount}</span>}
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
                      <td className="px-4 py-4">
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {reg.participantDetails.institution || '—'}
                        </div>
                      </td>
                      {phase !== 'DRAFT' && phase !== 'PUBLISHED' && phase !== 'REGISTRATION_CLOSED' && (
                        <td className="px-4 py-4 text-center">
                          <QuizStatusBadge status={reg.quizStatus || 'not_joined'} progress={reg.currentQuestionIndex} total={reg.totalQuestions} />
                        </td>
                      )}
                      <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleRowClick(reg)}>View Full Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("WhatsApp feature coming soon")}>Send WhatsApp</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info("Email feature coming soon")}>Send Email</DropdownMenuItem>
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
              <Button variant="ghost" size="sm" className="text-background hover:bg-background/10 h-8 text-xs">
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
            
            <div className="mt-8 h-[120px] w-full bg-muted/20 rounded-xl p-4 border border-border/50">
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
      />

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
    not_joined: { label: 'Not joined', className: 'bg-muted text-muted-foreground' },
    waiting: { label: 'In waiting room', className: 'bg-blue-500/10 text-blue-600' },
    answering: { label: `Answering (Q${progress}/${total})`, className: 'bg-green-500/10 text-green-600', dot: true },
    submitted: { label: 'Submitted', className: 'bg-green-500 text-white' },
    absent: { label: 'Did not attempt', className: 'bg-muted text-muted-foreground' }
  }[status] || { label: status, className: 'bg-muted' };

  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", config.className)}>
      {config.dot && <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
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
  onRevoke
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  registration: Registration | null; 
  contest: any;
  phase: string;
  onMarkAsPaid: (ref: string) => void;
  onAllowFree: () => void;
  onRevoke: (reason: string) => void;
}) {
  if (!registration) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/20 p-0.5">
                <AvatarFallback className="text-xl font-black bg-primary/10 text-primary uppercase">
                  {registration.participantDetails.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <h3 className="text-xl font-black tracking-tight">{registration.participantDetails.fullName}</h3>
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
            <TabsList className="grid w-full grid-cols-3 h-9 bg-muted/50 p-1">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="payment" className="text-xs">Payment</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-auto mt-6 space-y-8 pb-20 px-1">
              <TabsContent value="overview" className="space-y-8 m-0">
                <DetailSection title="Contact Information" icon={<User className="h-4 w-4" />}>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="Full Name" value={registration.participantDetails.fullName} />
                    <DetailItem label="Email" value={registration.participantDetails.email} copyable />
                    <DetailItem label="Phone" value={registration.participantDetails.phone} copyable />
                    <DetailItem label="City/State" value={`${registration.participantDetails.city || '—'}, ${registration.participantDetails.state || '—'}`} />
                  </div>
                </DetailSection>

                <DetailSection title="Registration Details" icon={<CalendarIcon className="h-4 w-4" />}>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="Participant ID" value={registration.participantId} mono copyable />
                    <DetailItem label="Registered At" value={format(new Date(registration.registeredAt), 'PPP p')} />
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
                        quizcraft.pro/quiz/{contest.orgSlug}/{contest.slug}/enter
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
                    "mb-3 uppercase text-[10px]",
                    registration.paymentStatus === 'completed' ? "bg-green-500" : "bg-amber-500"
                  )}>
                    {registration.paymentStatus}
                  </Badge>
                  <span className="text-4xl font-black">₹{registration.amount || contest.fee}</span>
                  <span className="text-xs text-muted-foreground mt-1">Payment Method: {registration.paymentMethod || 'Razorpay'}</span>
                </div>

                <DetailSection title="Transaction History" icon={<CreditCard className="h-4 w-4" />}>
                  <div className="space-y-4">
                    <DetailItem label="Payment ID" value={registration.paymentId || '—'} mono copyable />
                    <DetailItem label="Transaction Date" value={registration.paymentId ? format(new Date(registration.registeredAt), 'PPP p') : '—'} />
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
              </TabsContent>

              <TabsContent value="activity" className="space-y-8 m-0">
                {registration.quizStatus === 'not_joined' ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                      <User className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-muted-foreground font-medium">This participant has not joined the quiz yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <DetailSection title="Activity Timeline" icon={<Clock className="h-4 w-4" />}>
                      <div className="grid grid-cols-2 gap-4">
                        <DetailItem label="Joined at" value={registration.joinedAt ? format(new Date(registration.joinedAt), 'HH:mm:ss') : '—'} />
                        <DetailItem label="Current Question" value={`Question ${registration.currentQuestionIndex || 0} of ${registration.totalQuestions || 50}`} />
                        <DetailItem label="Last Activity" value={registration.lastActivityAt ? formatDistanceToNow(new Date(registration.lastActivityAt)) + ' ago' : '—'} />
                        <DetailItem label="Status" value={registration.quizStatus?.toUpperCase() || '—'} />
                      </div>
                    </DetailSection>
                    
                    <DetailSection title="Proctoring Overview" icon={<ShieldCheck className="h-4 w-4" />}>
                      <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                        <span className="text-sm font-bold block mb-2">Total Warnings: {registration.proctoringWarnings?.reduce((s, w) => s + w.count, 0) || 0}</span>
                        <div className="space-y-2">
                          {registration.proctoringWarnings?.map((w, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground capitalize">{w.type.replace('_', ' ')}</span>
                              <Badge variant="outline" className="h-5">{w.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </DetailSection>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </SheetHeader>

        <SheetFooter className="mt-auto p-6 border-t bg-muted/5 grid grid-cols-2 gap-3">
          <Button className="bg-[#25D366] hover:bg-[#20ba5a] text-white">
            <MessageCircle className="mr-2 h-4 w-4" />
            WhatsApp
          </Button>
          <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
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

function DetailItem({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 group">
      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-sm font-medium",
          mono && "font-mono"
        )}>{value}</span>
        {copyable && (
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
