'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Copy, Check, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Rupees } from './Rupees';
import { CampaignTimelineStrip } from './CampaignTimelineStrip';
import type { CampaignStatsDetail, MyCampaignItem } from '@/lib/types/ambassador';

function tierLabel(tier: MyCampaignItem['stats']['currentTier']) {
  if (!tier) return 'No tier yet';
  return tier.label ?? (tier.maxRegistrations ? `${tier.minRegistrations}-${tier.maxRegistrations} registrations` : `${tier.minRegistrations}+ registrations`);
}

interface ActiveCampaignCardProps {
  campaign: MyCampaignItem;
  /** Richer per-campaign detail (timeline + individual-ambassador rank) — MyCampaignItem
   *  alone doesn't carry phases/endDate/status or a populated leaderboardRanks, so the
   *  dashboard fetches this separately for just the hero campaign. Undefined while loading,
   *  null if the fetch failed — either way the card still renders with what it has. */
  detail?: CampaignStatsDetail | null;
}

/** The "My Campaigns" hero — the approved campaign with the most registrations, promoted
 *  above the rest so the ambassador's most active campaign leads instead of being just
 *  another card in the grid. */
export function ActiveCampaignCard({ campaign, detail }: ActiveCampaignCardProps) {
  const { stats } = campaign;
  const progress = stats.progressToNextTier;
  const percent = progress ? Math.min(100, Math.round((progress.current / progress.required) * 100)) : stats.currentTier ? 100 : 0;
  const remaining = progress ? progress.required - progress.current : null;

  const rankEntry = detail?.leaderboardRanks.find((r) => r.scope.kind === 'INDIVIDUAL_AMBASSADOR' && r.rank !== null);

  const [copied, setCopied] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  useEffect(() => {
    setReferralLink(`${window.location.origin}/contests/${campaign.contestSlug}/register?ref=${campaign.referralCode}`);
  }, [campaign.contestSlug, campaign.referralCode]);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}>
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        <CardContent className="pt-6 space-y-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-bold text-foreground">{campaign.name}</h3>
                {campaign.campaignStatus === 'LIVE' && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success bg-success/10 rounded-full px-2.5 py-1 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Live
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{campaign.organizationName} · {campaign.contestTitle}</p>
            </div>
            {rankEntry && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-foreground bg-accent/30 rounded-full px-3 py-1.5 shrink-0">
                <Trophy className="h-3.5 w-3.5" />
                Rank #{rankEntry.rank} · {rankEntry.label}
              </span>
            )}
          </div>

          {detail && <CampaignTimelineStrip status={detail.campaign.status} endDate={detail.campaign.endDate} phases={detail.campaign.phases} />}

          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-semibold text-foreground">{tierLabel(stats.currentTier)}</span>
              <span className="text-muted-foreground">{stats.registrationCount} registration{stats.registrationCount === 1 ? '' : 's'}</span>
            </div>
            <Progress value={percent} className="h-2" />
            {progress && stats.nextTier ? (
              <p className="text-xs text-muted-foreground mt-1.5">
                {remaining} more registration{remaining === 1 ? '' : 's'} → {stats.nextTier.label ?? 'next tier'} (
                <Rupees amount={stats.nextTier.amountPerRegistration} />/registration)
              </p>
            ) : stats.currentTier && !stats.nextTier ? (
              <p className="text-xs text-muted-foreground mt-1.5">You&apos;ve reached the top tier</p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap pt-4 border-t border-border/60">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Accrued reward</p>
              <p className="text-2xl font-bold text-foreground"><Rupees amount={stats.accruedAmount} /></p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyLink} disabled={!referralLink}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button asChild size="sm">
                <Link href={`/ambassador/dashboard/campaigns/${campaign.campaignId}`}>
                  Open campaign
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
