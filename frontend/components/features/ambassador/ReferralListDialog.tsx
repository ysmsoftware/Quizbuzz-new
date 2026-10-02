'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Users } from 'lucide-react';
import { useOrgAmbassadorReferrals } from '@/lib/hooks/useOrgAmbassadorReport';

interface ReferralListDialogProps {
  campaignId: string;
  enrollmentId: string | null;
  ambassadorName: string;
  onOpenChange: (open: boolean) => void;
}

/** Admin-only drill-down behind one ambassador's registrationCount — full contact detail per
 *  registration their referral link brought in (see the ambassador-facing equivalent in
 *  ambassador/dashboard/campaigns/[campaignId], which shows names only). */
export function ReferralListDialog({ campaignId, enrollmentId, ambassadorName, onOpenChange }: ReferralListDialogProps) {
  const [page, setPage] = useState(1);
  const { rows, pagination, isLoading } = useOrgAmbassadorReferrals(campaignId, enrollmentId, page);

  return (
    <Dialog open={!!enrollmentId} onOpenChange={(open) => { if (!open) { setPage(1); onOpenChange(false); } }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Registrations referred by {ambassadorName}</DialogTitle>
          <DialogDescription>Everyone who registered through this ambassador&apos;s referral link.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : rows.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Users className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle>No registrations yet</EmptyTitle>
            <EmptyDescription>Registrations referred by this ambassador will appear here.</EmptyDescription>
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50 max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>College</TableHead>
                  <TableHead className="text-right">Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Only confirmed registrations count as referrals, so no status column. */}
                {rows.map((r) => (
                  <TableRow key={r.participantId}>
                    <TableCell className="align-top">
                      <p className="font-medium">{r.firstName} {r.lastName}</p>
                      <p className="text-xs text-muted-foreground">{r.email || r.phone || '—'}</p>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal min-w-56">
                      <p className="text-xs text-muted-foreground">{r.college || '—'}</p>
                      {r.department && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{r.department}</p>}
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <p className="text-sm font-semibold">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">{r.registrationRef}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.limit} onPageChange={setPage} />
        )}
      </DialogContent>
    </Dialog>
  );
}
