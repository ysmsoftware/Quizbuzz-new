'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { useOrgAmbassador } from '@/lib/hooks/useOrgAmbassadors';
import { usePlatformAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { CAMPAIGN_STATUS_BADGE_VARIANT } from './campaign-status';
import { Rupees } from './Rupees';

/**
 * Org-admin's read-only view of one ambassador's full profile — opened from a row in
 * AmbassadorDirectory. Distinct from ProofReviewSheet: that's the per-application decision
 * surface (approve/reject one campaign's enrollment); this is "who is this person, and
 * what have they done across every campaign of ours they've joined" — no actions here,
 * approve/reject still happens from the Applications tab.
 */
export function AmbassadorProfileSheet({ ambassadorId, onClose }: { ambassadorId: string | null; onClose: () => void }) {
  const { ambassador, isLoading } = useOrgAmbassador(ambassadorId);
  const { types } = usePlatformAmbassadorTypes();
  const typeLabel = types.find((t) => t.key === ambassador?.ambassadorType)?.label ?? ambassador?.ambassadorType;

  return (
    <Sheet open={!!ambassadorId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Ambassador Profile</SheetTitle>
        </SheetHeader>
        <div className="px-4 space-y-5 overflow-y-auto">
          {isLoading || !ambassador ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">
                    {ambassador.firstName} {ambassador.lastName}
                  </p>
                  <Badge variant="secondary" className="font-normal">
                    {typeLabel}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Joined the platform {new Date(ambassador.joinedPlatformAt).toLocaleDateString()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium break-all">{ambassador.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{ambassador.phone || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/50 p-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Registrations</p>
                  <p className="text-lg font-semibold">{ambassador.totalRegistrations}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Accrued</p>
                  <p className="text-lg font-semibold">
                    <Rupees amount={ambassador.totalAccruedAmount} />
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Campaigns ({ambassador.campaigns.length})
                </p>
                <div className="space-y-2">
                  {ambassador.campaigns.map((c) => (
                    <div key={c.enrollmentId} className="rounded-lg border border-border/50 p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{c.campaignName}</p>
                        <Badge variant={CAMPAIGN_STATUS_BADGE_VARIANT[c.campaignStatus]} className="shrink-0">
                          {c.campaignStatus}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Code: {c.referralCode}</span>
                        <span>{c.registrationCount} registration{c.registrationCount === 1 ? '' : 's'}</span>
                        {c.currentTierLabel && <span>Tier: {c.currentTierLabel}</span>}
                        <span>
                          <Rupees amount={c.accruedAmount} />
                        </span>
                        <span>Joined {new Date(c.joinedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {Object.keys(ambassador.applicationData || {}).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Application Details</p>
                  <div className="space-y-1 text-sm">
                    {Object.entries(ambassador.applicationData).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-medium text-right">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Proof Document</p>
                <a
                  href={ambassador.proofDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-border overflow-hidden hover:border-primary transition-colors"
                >
                  <img
                    src={ambassador.proofDownloadUrl}
                    alt="Proof document"
                    loading="lazy"
                    className="w-full h-auto max-h-80 object-contain bg-muted"
                  />
                </a>
              </div>
            </>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
