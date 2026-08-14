'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Clock, XCircle, ShieldAlert, Trophy, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useAmbassadorMe } from '@/lib/hooks/useAmbassadorMe';
import { useAvailableCampaigns, useMyCampaigns } from '@/lib/hooks/useAmbassadorCampaigns';
import { CampaignCard } from '@/components/features/ambassador/CampaignCard';
import { toast } from 'sonner';

export default function AmbassadorDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const { ambassador, isLoading, isError } = useAmbassadorMe();

  useEffect(() => {
    if (isError) router.replace(`/ambassador/${orgSlug}/login`);
  }, [isError, orgSlug, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!ambassador) return null;

  if (ambassador.status === 'PENDING') {
    return (
      <StatusScreen
        icon={<Clock className="h-6 w-6" />}
        title="Application Under Review"
        description="We're reviewing your ambassador application. You'll receive an email once a decision is made."
      />
    );
  }

  if (ambassador.status === 'REJECTED') {
    return (
      <StatusScreen
        icon={<XCircle className="h-6 w-6 text-destructive" />}
        title="Application Not Approved"
        description={ambassador.rejectionReason || 'Your application was not approved this time.'}
      />
    );
  }

  if (ambassador.status === 'SUSPENDED') {
    return (
      <StatusScreen
        icon={<ShieldAlert className="h-6 w-6 text-destructive" />}
        title="Account Suspended"
        description="Your ambassador account has been suspended. Contact the organizer for details."
      />
    );
  }

  return <ApprovedDashboard orgSlug={orgSlug} />;
}

function StatusScreen({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="max-w-sm w-full">
        <CardContent className="pt-6 text-center space-y-3">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">{icon}</div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ApprovedDashboard({ orgSlug }: { orgSlug: string }) {
  const { campaigns: joinedCampaigns, isLoading: joinedLoading, join, joinLoading } = useMyCampaigns();
  const { campaigns: availableCampaigns, isLoading: availableLoading, isError: availableError } = useAvailableCampaigns();

  const handleJoin = async (campaignId: string) => {
    try {
      await join(campaignId);
      toast.success('Joined campaign');
    } catch (err: any) {
      toast.error(err.message || 'Failed to join campaign');
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-bold text-foreground">My Campaigns</h1>
          <p className="text-sm text-muted-foreground">Track your referrals and rewards</p>
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
              <EmptyTitle>No campaigns joined yet</EmptyTitle>
              <EmptyDescription>Join an available campaign below to get your referral link.</EmptyDescription>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {joinedCampaigns.map((campaign) => (
                <CampaignCard key={campaign.campaignId} campaign={campaign} orgSlug={orgSlug} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Available Campaigns</h2>
          {availableLoading ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : availableError || availableCampaigns.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Megaphone className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>No campaigns available</EmptyTitle>
              <EmptyDescription>Check back later for new campaigns to join.</EmptyDescription>
            </Empty>
          ) : (
            <div className="space-y-2">
              {availableCampaigns.map((campaign) => (
                <Card key={campaign.id} className="border-border/50">
                  <CardContent className="py-4 flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground truncate">{campaign.name}</span>
                    <Button size="sm" disabled={joinLoading} onClick={() => handleJoin(campaign.id)}>
                      Join
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
