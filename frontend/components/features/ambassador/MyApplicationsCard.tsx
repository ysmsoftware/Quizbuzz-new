'use client';

import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyCampaigns } from '@/lib/hooks/useAmbassadorCampaigns';
import type { AmbassadorStatus } from '@/lib/types/ambassador';

const STATUS_CHIP: Record<AmbassadorStatus, string> = {
  APPROVED: 'bg-success/10 text-success',
  PENDING: 'bg-warning/45 text-accent-foreground',
  REJECTED: 'bg-destructive/10 text-destructive',
  SUSPENDED: 'bg-secondary text-muted-foreground',
};

const STATUS_LABEL: Record<AmbassadorStatus, string> = {
  APPROVED: 'Approved',
  PENDING: 'Pending review',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

/** Every campaign this ambassador has applied to, with its decision status — data the
 *  profile page had access to all along (GET .../campaigns/mine) but never surfaced. */
export function MyApplicationsCard() {
  const { campaigns, isLoading } = useMyCampaigns({ limit: 100 });

  return (
    <Card className="border-border/50">
      <CardContent className="pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-4">My applications</p>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-xs text-muted-foreground">You haven&apos;t applied to any campaigns yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {campaigns.map((c) => {
              const row = (
                <div className="flex items-center gap-3 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground shrink-0">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.organizationName}</p>
                  </div>
                  <span className={`text-[10px] font-bold rounded-full px-2 py-1 shrink-0 ${STATUS_CHIP[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
              );
              return c.status === 'APPROVED' ? (
                <Link key={c.enrollmentId} href={`/ambassador/dashboard/campaigns/${c.campaignId}`} className="block hover:bg-muted/40 -mx-1 px-1 rounded-lg transition-colors">
                  {row}
                </Link>
              ) : (
                <div key={c.enrollmentId}>{row}</div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
