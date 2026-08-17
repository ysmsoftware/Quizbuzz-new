'use client';

import { Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { CampaignSpeedBonusStatus } from '@/lib/types/ambassador';

export function SpeedBonusStrip({ speedBonus }: { speedBonus: CampaignSpeedBonusStatus | null }) {
  if (!speedBonus) return null;

  if (speedBonus.earned && speedBonus.tier) {
    return (
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="py-3.5 flex items-center gap-3">
          <Zap className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="font-semibold text-foreground text-sm">{speedBonus.tier.label}</p>
            <p className="text-xs text-muted-foreground">
              Speed bonus earned{speedBonus.tier.goodie ? ` — includes ${speedBonus.tier.goodie.label}` : ''}
            </p>
          </div>
        </CardContent>
      </Card>
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
