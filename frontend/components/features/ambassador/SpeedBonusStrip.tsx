'use client';

import { Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { GoodieHoverCard } from './GoodieHoverCard';
import { cn } from '@/lib/utils';
import { onImageError } from '@/lib/utils/image';
import type { CampaignSpeedBonusStatus } from '@/lib/types/ambassador';

export function SpeedBonusStrip({ speedBonus }: { speedBonus: CampaignSpeedBonusStatus | null }) {
  if (!speedBonus) return null;

  if (speedBonus.earned) {
    return (
      <div className="space-y-3">
        {speedBonus.tiers.map((tier, i) => {
          const goodie = tier.goodie;
          const card = (
            <Card className={cn('border-warning/40 bg-warning/5', goodie && 'cursor-default')}>
              <CardContent className="py-3.5 flex items-center gap-3">
                <Zap className="h-5 w-5 text-warning shrink-0" />
                {goodie?.imageUrl && (
                  <span className="relative inline-block h-8 w-8 shrink-0">
                    <Image src={goodie.imageUrl} alt="" fill sizes="32px" onError={onImageError} className="rounded object-cover border border-border/50" />
                  </span>
                )}
                <div>
                  <p className="font-semibold text-foreground text-sm">{tier.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Speed bonus earned{goodie ? ` — includes ${goodie.label}` : ''}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
          return <div key={i}>{goodie ? <GoodieHoverCard goodie={goodie}>{card}</GoodieHoverCard> : card}</div>;
        })}
      </div>
    );
  }

  if (speedBonus.daysToMilestone !== null) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-3.5 flex items-center gap-3">
          <Zap className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className="font-semibold text-foreground text-sm">{speedBonus.daysToMilestone.toFixed(1)} days left to qualify</p>
            <p className="text-xs text-muted-foreground">Hit the milestone in time for a speed bonus</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
