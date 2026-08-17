'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Trophy } from 'lucide-react';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useAmbassadorMe } from '@/lib/hooks/useAmbassadorMe';
import { useMyCampaigns } from '@/lib/hooks/useAmbassadorCampaigns';
import { ActiveCampaignCard } from '@/components/features/ambassador/ActiveCampaignCard';
import { Rupees } from '@/components/features/ambassador/Rupees';

/**
 * Overview — greeting, aggregate stats, and the hero active-campaign card only. The full
 * campaign list (joined + available to apply) lives at /ambassador/dashboard/campaigns.
 */
export default function AmbassadorDashboardPage() {
  const { ambassador } = useAmbassadorMe();
  if (!ambassador) return null;
  return <LoadedDashboard firstName={ambassador.firstName} />;
}

function LoadedDashboard({ firstName }: { firstName: string }) {
  const { campaigns: joinedCampaigns, isLoading: joinedLoading } = useMyCampaigns();

  const approvedCampaigns = useMemo(() => joinedCampaigns.filter((c) => c.status === 'APPROVED'), [joinedCampaigns]);

  // The most-active approved campaign leads the page; everything else (including
  // pending/rejected applications) is in the full list at /dashboard/campaigns.
  const heroCampaign = useMemo(
    () => [...approvedCampaigns].sort((a, b) => b.stats.registrationCount - a.stats.registrationCount)[0] ?? null,
    [approvedCampaigns]
  );

  const totals = useMemo(
    () => ({
      campaigns: joinedCampaigns.length,
      registrations: approvedCampaigns.reduce((sum, c) => sum + c.stats.registrationCount, 0),
      earned: approvedCampaigns.reduce((sum, c) => sum + c.stats.accruedAmount, 0),
    }),
    [joinedCampaigns, approvedCampaigns]
  );

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Hi {firstName}</h1>
            <p className="text-sm text-muted-foreground">Track your referrals and rewards across every campaign</p>
          </div>
          {!joinedLoading && joinedCampaigns.length > 0 && (
            <div className="flex gap-5 tabular-nums">
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">{totals.campaigns}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Campaigns</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">{totals.registrations}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Registrations</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground"><Rupees amount={totals.earned} /></p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Earned</p>
              </div>
            </div>
          )}
        </div>

        <section className="space-y-3">
          {joinedLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ) : joinedCampaigns.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Trophy className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>No applications yet</EmptyTitle>
              <EmptyDescription>Apply to an available campaign below to get started.</EmptyDescription>
            </Empty>
          ) : heroCampaign ? (
            <>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active campaign</h2>
              <ActiveCampaignCard campaign={heroCampaign} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Your application is awaiting review — you&rsquo;ll see it here once approved.</p>
          )}
        </section>

        <Link
          href="/ambassador/dashboard/campaigns"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          View all campaigns
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
