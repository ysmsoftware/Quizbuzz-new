'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, formatDistanceToNowStrict } from 'date-fns';
import {
  Plus,
  Archive,
  BookOpen,
  Search,
  ChevronRight,
  Calendar,
  Clock,
  History,
  ArrowUpDown,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useContests } from '@/lib/hooks/useContests';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import type { Contest } from '@/lib/types';
import type { ContestStatus } from '@/lib/api/dashboard.api';

const CLOSING_SOON_HOURS = 48;
const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

type StatusTab = 'ALL' | ContestStatus;

const TAB_ORDER: StatusTab[] = ['ALL', 'DRAFT', 'PUBLISHED', 'REGISTRATION_CLOSED', 'LIVE', 'EVALUATION', 'RESULTS_OUT', 'COMPLETED', 'CANCELLED'];
const TAB_LABEL: Record<StatusTab, string> = {
  ALL: 'All',
  DRAFT: 'Draft',
  PUBLISHED: 'Registration open',
  REGISTRATION_CLOSED: 'Registration closed',
  LIVE: 'Live',
  EVALUATION: 'Evaluating',
  RESULTS_OUT: 'Results out',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_PILL: Record<ContestStatus, string> = {
  DRAFT: 'border border-border text-muted-foreground',
  PUBLISHED: 'bg-blue-500 text-white',
  REGISTRATION_CLOSED: 'bg-amber-500 text-white',
  LIVE: 'bg-red-500 text-white',
  EVALUATION: 'bg-purple-500 text-white',
  RESULTS_OUT: 'bg-green-500 text-white',
  COMPLETED: 'bg-slate-500 text-white',
  CANCELLED: 'border border-destructive/40 text-destructive',
};

type SortKey = 'startSoonest' | 'newest' | 'closingSoonest' | 'mostParticipants';
const SORT_LABEL: Record<SortKey, string> = {
  startSoonest: 'Starting soonest',
  newest: 'Newest created',
  closingSoonest: 'Registration closing soonest',
  mostParticipants: 'Most participants',
};
const SORT_PARAMS: Record<SortKey, { sortBy: 'startTime' | 'createdAt' | 'registrationDeadline' | 'participants'; sortOrder: 'asc' | 'desc' }> = {
  startSoonest: { sortBy: 'startTime', sortOrder: 'asc' },
  newest: { sortBy: 'createdAt', sortOrder: 'desc' },
  closingSoonest: { sortBy: 'registrationDeadline', sortOrder: 'asc' },
  mostParticipants: { sortBy: 'participants', sortOrder: 'desc' },
};

function isClosingSoon(contest: Contest, status: ContestStatus): boolean {
  if (status !== 'PUBLISHED') return false;
  const hoursLeft = (new Date(contest.registrationDeadline).getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursLeft > 0 && hoursLeft <= CLOSING_SOON_HOURS;
}

function registrationLabel(contest: Contest, status: ContestStatus): { text: string; warn?: boolean } {
  if (status === 'DRAFT') return { text: 'Not published yet' };
  if (status === 'CANCELLED') return { text: 'Contest cancelled' };
  const deadline = new Date(contest.registrationDeadline);
  const hoursLeft = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursLeft <= 0) return { text: 'Registration closed' };
  if (hoursLeft <= CLOSING_SOON_HOURS) return { text: `Closes in ${formatDistanceToNowStrict(deadline)}`, warn: true };
  return { text: `Closes ${format(deadline, 'MMM d')}` };
}

export default function ContestsPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<StatusTab>('ALL');
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);

  // Debounce the search box — this now fires a real, paginated server request per change.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => setPage(1), [search, tab, sort]);

  const { contests = [], isLoading, contestsQuery } = useContests({
    limit: PAGE_SIZE,
    page,
    search: search || undefined,
    status: tab === 'ALL' ? undefined : tab,
    ...SORT_PARAMS[sort],
  });

  const pagination = contestsQuery.data?.data?.pagination as { total?: number; totalPages?: number } | undefined;
  const total = pagination?.total ?? contests.length;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Manage contests</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {total.toLocaleString('en-IN')} contest{total === 1 ? '' : 's'} · click any row to open, edit and manage it
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/org/contests/archived">
            <Button variant="outline" className="gap-2">
              <Archive className="h-4 w-4" />
              Archived
            </Button>
          </Link>
          <Link href="/org/contests/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New contest
            </Button>
          </Link>
        </div>
      </div>

      <WidgetErrorBoundary name="Contests List">
        <Card className="border-border/50">
          <CardHeader className="space-y-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                All contests
              </CardTitle>
              <CardDescription>A list of all contests in your organization</CardDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contests by title…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="w-[220px]">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(SORT_LABEL) as [SortKey, string][]).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto -mb-px border-b border-border/50">
              {TAB_ORDER.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'px-1 pb-2.5 mr-4 text-sm whitespace-nowrap border-b-2 transition-colors',
                    tab === t ? 'border-primary text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {TAB_LABEL[t]}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[92px] w-full rounded-xl" />
                ))}
              </div>
            ) : contests.length === 0 && tab === 'ALL' && !search ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No contests yet</p>
                <Link href="/org/contests/create">
                  <Button>Create Your First Contest</Button>
                </Link>
              </div>
            ) : contests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No contests match this filter.</p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {contests.map((contest) => {
                    const status = (contest.status as unknown as ContestStatus) ?? 'DRAFT';
                    const closingSoon = isClosingSoon(contest, status);
                    const reg = registrationLabel(contest, status);
                    const tag = contest.topics?.[0];
                    const priceAmount = contest.paymentConfig?.amount ?? 0;
                    const isPaid = !!contest.paymentEnabled && priceAmount > 0;
                    const capacityPct = contest.maxParticipants
                      ? Math.min(100, Math.round(((contest.currentParticipants ?? 0) / contest.maxParticipants) * 100))
                      : null;

                    return (
                      <button
                        key={contest.id}
                        type="button"
                        onClick={() => router.push(`/org/contests/${contest.id}`)}
                        className="w-full text-left flex items-center gap-4 border border-border/50 rounded-xl p-4 hover:border-primary/30 hover:bg-secondary/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-sm font-semibold">{contest.title}</span>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
                                closingSoon ? 'bg-warning text-accent-foreground' : STATUS_PILL[status]
                              )}
                            >
                              {status === 'LIVE' && (
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                                </span>
                              )}
                              {closingSoon ? 'Closing soon' : TAB_LABEL[status]}
                            </span>
                            {contest.isPrivate && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                <Lock className="h-2.5 w-2.5" />
                                Private
                              </span>
                            )}
                            {tag && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                                {tag}
                              </span>
                            )}
                            <span
                              className={cn(
                                'text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums',
                                isPaid ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {isPaid ? `₹${priceAmount}` : 'Free'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3.5 text-xs text-muted-foreground flex-wrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              Starts {format(new Date(contest.startTime), 'MMM d, h:mm a')}
                            </span>
                            <span className={cn('inline-flex items-center gap-1.5', reg.warn && 'text-warning font-medium')}>
                              <Clock className="h-3.5 w-3.5" />
                              {reg.text}
                            </span>
                            {contest.createdAt && (
                              <span className="inline-flex items-center gap-1.5">
                                <History className="h-3.5 w-3.5" />
                                Created {format(new Date(contest.createdAt), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="w-[168px] shrink-0">
                          {capacityPct !== null ? (
                            <>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-semibold tabular-nums">
                                  {contest.currentParticipants ?? 0} / {contest.maxParticipants}
                                </span>
                                <span className="text-muted-foreground">{capacityPct}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full', capacityPct >= 90 ? 'bg-warning' : 'bg-primary')}
                                  style={{ width: `${capacityPct}%` }}
                                />
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {Math.max(0, contest.maxParticipants - (contest.currentParticipants ?? 0))} seats left
                              </p>
                            </>
                          ) : (
                            <p className="text-xs font-semibold tabular-nums text-right">
                              {contest.currentParticipants ?? 0} joined
                            </p>
                          )}
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>

                <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} className="mt-4" />
              </>
            )}
          </CardContent>
        </Card>
      </WidgetErrorBoundary>
    </div>
  );
}
