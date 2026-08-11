'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { useOrgAmbassadorApplication } from '@/lib/hooks/useOrgAmbassadorApplications';

export function ProofReviewSheet({ applicationId, onClose }: { applicationId: string | null; onClose: () => void }) {
  const { application, isLoading } = useOrgAmbassadorApplication(applicationId ?? '');

  return (
    <Sheet open={!!applicationId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Application Detail</SheetTitle>
        </SheetHeader>
        <div className="px-4 space-y-4 overflow-y-auto">
          {isLoading || !application ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">
                    {application.firstName} {application.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{application.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{application.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{application.ambassadorType}</p>
                </div>
              </div>

              {Object.keys(application.applicationData || {}).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Application Details</p>
                  <div className="space-y-1 text-sm">
                    {Object.entries(application.applicationData).map(([key, value]) => (
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
                  href={application.proofDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-border overflow-hidden hover:border-primary transition-colors"
                >
                  <img
                    src={application.proofDownloadUrl}
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
