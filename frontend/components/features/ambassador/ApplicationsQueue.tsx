'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { useOrgAmbassadorApplications } from '@/lib/hooks/useOrgAmbassadorApplications';
import { ProofReviewSheet } from './ProofReviewSheet';
import type { AmbassadorStatus } from '@/lib/types/ambassador';

const STATUS_OPTIONS: { value: AmbassadorStatus | 'ALL'; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

export function ApplicationsQueue() {
  const [status, setStatus] = useState<AmbassadorStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const { applications, pagination, isLoading, approve, approveLoading, reject, rejectLoading } =
    useOrgAmbassadorApplications({ status, page, limit: 20 });

  const handleApprove = async (id: string) => {
    try {
      await approve(id);
      toast.success('Application approved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    setRejectError('');
    try {
      await reject({ id: rejectId, reason: rejectReason.trim() });
      toast.success('Application rejected');
      setRejectId(null);
      setRejectReason('');
    } catch (err: any) {
      setRejectError(err.message || 'Failed to reject');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={status} onValueChange={(v) => { setStatus(v as AmbassadorStatus); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <FileText className="h-5 w-5" />
          </EmptyMedia>
          <EmptyTitle>No applications</EmptyTitle>
          <EmptyDescription>No {status.toLowerCase()} applications right now.</EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">
                    {app.ambassador.firstName} {app.ambassador.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{app.ambassador.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{app.ambassador.ambassadorType}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{app.campaignName}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(app.appliedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-1.5">
                    <Button size="sm" variant="outline" onClick={() => setReviewId(app.id)}>
                      Review
                    </Button>
                    {status === 'PENDING' && (
                      <>
                        <Button size="icon" variant="outline" className="h-8 w-8" disabled={approveLoading} onClick={() => handleApprove(app.id)}>
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => {
                            setRejectId(app.id);
                            setRejectError('');
                          }}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <PaginationBar
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pagination.limit}
          onPageChange={setPage}
        />
      )}

      <ProofReviewSheet applicationId={reviewId} onClose={() => setReviewId(null)} />

      <Dialog
        open={!!rejectId}
        onOpenChange={(open) => {
          if (!open) {
            setRejectId(null);
            setRejectError('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>Provide a reason — this will be visible to the applicant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection"
              rows={3}
              aria-invalid={!!rejectError}
              className={rejectError ? 'border-destructive' : undefined}
            />
            {rejectError && <p className="text-sm text-destructive">{rejectError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || rejectLoading} onClick={handleReject}>
              {rejectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
