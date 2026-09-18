'use client';

import { Zap, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { MilestoneProgress } from './MilestoneProgress';
import { GoodieHoverCard } from './GoodieHoverCard';
import { Rupees } from './Rupees';
import { onImageError } from '@/lib/utils/image';
import type { CampaignStats } from '@/lib/types/ambassador';

export function CampaignStatsPanel({ stats }: { stats: CampaignStats }) {
  const earnedSpeedBonusGoodie = stats.speedBonus?.earned ? stats.speedBonus.tier?.goodie : undefined;
  const earnedSpeedBonusCard = stats.speedBonus?.earned && stats.speedBonus.tier && (
    <Card className={`border-warning/40 bg-warning/5 ${earnedSpeedBonusGoodie ? 'cursor-default' : ''}`}>
      <CardContent className="pt-6 flex items-center gap-3">
        <Zap className="h-5 w-5 text-warning shrink-0" />
        {earnedSpeedBonusGoodie?.imageUrl && (
          <span className="relative inline-block h-8 w-8 shrink-0">
            <Image src={earnedSpeedBonusGoodie.imageUrl} alt="" fill sizes="32px" onError={onImageError} className="rounded object-cover border border-border/50" />
          </span>
        )}
        <div>
          <p className="font-semibold text-foreground text-sm">{stats.speedBonus.tier.label}</p>
          <p className="text-xs text-muted-foreground">
            Speed bonus earned{earnedSpeedBonusGoodie ? ` — includes ${earnedSpeedBonusGoodie.label}` : ''}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardContent className="pt-6 space-y-4">
          {/* Tier name/range, progress bar, and the current tier's goodie (if any) all
              come from MilestoneProgress — kept in one place instead of duplicating the
              goodie line here, so CampaignCard's compact view gets it too. */}
          <MilestoneProgress stats={stats} />
        </CardContent>
      </Card>

      {earnedSpeedBonusCard && (
        earnedSpeedBonusGoodie ? <GoodieHoverCard goodie={earnedSpeedBonusGoodie}>{earnedSpeedBonusCard}</GoodieHoverCard> : earnedSpeedBonusCard
      )}

      {stats.speedBonus && !stats.speedBonus.earned && stats.speedBonus.daysToMilestone !== null && (
        <Card className="border-border/50">
          <CardContent className="pt-6 flex items-center gap-3">
            <Zap className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-semibold text-foreground text-sm">
                {stats.speedBonus.daysToMilestone.toFixed(1)} days left to qualify
              </p>
              <p className="text-xs text-muted-foreground">Hit the milestone in time for a speed bonus</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6 flex items-center gap-3">
          <Wallet className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Accrued reward</p>
            <p className="text-xl font-bold text-foreground"><Rupees amount={stats.accruedAmount} /></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
