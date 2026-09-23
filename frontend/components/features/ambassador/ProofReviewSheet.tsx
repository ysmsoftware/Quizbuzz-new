'use client';

import Image from 'next/image';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { useOrgAmbassadorApplication } from '@/lib/hooks/useOrgAmbassadorApplications';
import { usePlatformAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { AmbassadorAvatar } from './AmbassadorAvatar';
import { FileDownloadButton } from './FileDownloadButton';

interface ProofReviewSheetProps {
  applicationId: string | null;
  onClose: () => void;
  /** When provided and the application is PENDING, the footer shows Approve / Reject. */
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  approveLoading?: boolean;
}

export function ProofReviewSheet({ applicationId, onClose, onApprove, onReject, approveLoading }: ProofReviewSheetProps) {
  const { application, isLoading } = useOrgAmbassadorApplication(applicationId ?? '');
  const { types } = usePlatformAmbassadorTypes();
  const ambassadorType = types.find((t) => t.key === application?.ambassador.ambassadorType);

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
              <div className="flex items-center gap-3">
                <AmbassadorAvatar
                  firstName={application.ambassador.firstName}
                  lastName={application.ambassador.lastName}
                  profileImageUrl={application.profileImageDownloadUrl}
                  size={56}
                />
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Campaign</p>
                  <p className="text-sm font-medium">{application.campaignName}</p>
                </div>
                {application.profileImageAttachmentUrl && (
                  <FileDownloadButton href={application.profileImageAttachmentUrl} label="Download profile image" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">
                    {application.ambassador.firstName} {application.ambassador.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{application.ambassador.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{application.ambassador.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{application.ambassador.ambassadorType}</p>
                </div>
              </div>

              {Object.keys(application.ambassador.applicationData || {}).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Application Details</p>
                  <div className="space-y-1 text-sm">
                    {Object.entries(application.ambassador.applicationData).map(([key, value]) => {
                      const fieldDef = ambassadorType?.applicationFields.find((f) => f.key === key);
                      const displayLabel = fieldDef?.label || key;
                      return (
                        <div key={key} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{displayLabel}</span>
                          <span className="font-medium text-right">{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Proof Document</p>
                  <FileDownloadButton href={application.proofAttachmentUrl} label="Download ID proof" />
                </div>
                <a
                  href={application.proofDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-border overflow-hidden hover:border-primary transition-colors"
                >
                  <Image
                    src={application.proofDownloadUrl}
                    alt="Proof document"
                    width={400}
                    height={300}
                    loading="lazy"
                    style={{ width: '100%', height: 'auto' }}
                    className="max-h-80 object-contain bg-muted"
                  />
                </a>
              </div>
            </>
          )}
        </div>
        <SheetFooter>
          {application?.status === 'PENDING' && onApprove && onReject && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => onReject(application.id)} className="text-destructive">
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button onClick={() => onApprove(application.id)} disabled={approveLoading}>
                {approveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
