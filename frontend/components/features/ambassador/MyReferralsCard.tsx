'use client';

import { useState } from 'react';
import { ArrowRight, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useMyReferrals } from '@/lib/hooks/useAmbassadorCampaigns';

/** Ambassador-facing "who did I refer" summary — a compact card (count + "View all") that
 *  opens a right-side sheet (full-screen on mobile, half-width on desktop) with the full,
 *  paginated, newest-first list on demand. Names + college only, no other contact detail —
 *  see ReferralListDialog for the org-admin equivalent with full contact detail. */
export function MyReferralsCard({ campaignId, registrationCount }: { campaignId: string; registrationCount: number }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { referrals, pagination, isLoading } = useMyReferrals(campaignId, page, open);

  return (
    <>
      <Card className="border-border/50 py-4">
        <CardContent className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{registrationCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{registrationCount === 1 ? 'registration' : 'registrations'} via your link</p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={registrationCount === 0} onClick={() => setOpen(true)}>
            View all
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPage(1); }}>
        <SheetContent side="right" className="w-full sm:max-w-[50vw] flex flex-col p-0 gap-0">
          <SheetHeader className="border-b border-border/40">
            <SheetTitle>Your referrals</SheetTitle>
            <SheetDescription>Everyone who registered through your link, newest first.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4">
            {isLoading ? (
              <div className="space-y-2 py-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : referrals.length === 0 ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <Users className="h-5 w-5" />
                </EmptyMedia>
                <EmptyTitle>No registrations yet</EmptyTitle>
                <EmptyDescription>People who join through your referral link will show up here.</EmptyDescription>
              </Empty>
            ) : (
              <ul className="divide-y divide-border/40">
                {referrals.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.firstName} {r.lastName ?? ''}</p>
                      {r.email && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.email}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="p-4 border-t border-border/40 shrink-0">
              <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.limit} onPageChange={setPage} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
