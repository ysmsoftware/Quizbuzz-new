'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { Users } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRecentRegistrations } from '@/lib/hooks/useDashboard';
import type { ParticipantStatus } from '@/lib/api/dashboard.api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardWidgetError } from '@/components/features/dashboard/dashboard-shared';

const STATUS_LABEL: Record<ParticipantStatus, string> = {
  PENDING_PAYMENT: 'Pending payment',
  REGISTERED: 'Registered',
  CHECKED_IN: 'Checked in',
  IN_WAITING: 'In waiting room',
  IN_QUIZ: 'In quiz',
  SUBMITTED: 'Submitted',
  DISQUALIFIED: 'Disqualified',
  ABSENT: 'Absent',
};

const PAGE_SIZE = 20;

export default function ParticipantsPage() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.id || '';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ParticipantStatus | 'all'>('all');

  const { data, isLoading, isError, refetch, isFetching } = useRecentRegistrations(orgId, {
    page,
    limit: PAGE_SIZE,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    status: status === 'all' ? undefined : status,
  });

  const registrations = data?.data.data ?? [];
  const total = data?.data.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Participants</h2>
        <p className="text-sm text-muted-foreground mt-1">Everyone who has registered for one of your contests.</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              All participants
            </CardTitle>
            <CardDescription>{total.toLocaleString('en-IN')} total registrations</CardDescription>
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as ParticipantStatus | 'all');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>

        <CardContent aria-busy={isFetching}>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <DashboardWidgetError message="Couldn't load participants." onRetry={() => refetch()} />
          ) : registrations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Users className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {status === 'all' ? 'No one has registered yet.' : 'No registrations match this status.'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Contest</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.contact.firstName} {r.contact.lastName ?? ''}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.contact.email}</TableCell>
                      <TableCell>
                        <Link href={`/org/contests/${r.contest.id}/registrations`} className="hover:underline hover:text-primary">
                          {r.contest.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{STATUS_LABEL[r.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground" title={format(new Date(r.createdAt), 'PPpp')}>
                        {formatDistanceToNowStrict(new Date(r.createdAt), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} className="mt-4" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
