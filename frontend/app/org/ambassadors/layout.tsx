'use client';

import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorProgramEnabled } from '@/lib/hooks/useAmbassadorProgramEnabled';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route guard for the whole /org/ambassadors section. The sidebar (app/org/layout.tsx)
 * already hides the nav item when the org's `ambassador_program_enabled` flag is off,
 * but that alone doesn't stop someone typing the URL directly — this layout wraps
 * every page under this route and blocks rendering them until the same flag check
 * (shared, deduped query) confirms the org actually has access.
 */
export default function AmbassadorsSectionLayout({ children }: { children: React.ReactNode }) {
  const { activeOrg } = useAuth();
  const { enabled, isLoading } = useAmbassadorProgramEnabled(activeOrg?.id ?? '');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldOff />
          </EmptyMedia>
          <EmptyTitle>Ambassador Program isn&apos;t available</EmptyTitle>
          <EmptyDescription>
            This feature isn&apos;t enabled for your organization yet. Reach out to your QuizBuzz account
            manager if you&apos;d like to run a campus ambassador campaign.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <>{children}</>;
}
