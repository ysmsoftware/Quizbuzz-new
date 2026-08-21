'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { CampaignTimelineStrip } from './CampaignTimelineStrip';
import { Rupees } from './Rupees';
import type { AvailableCampaignItem, MilestoneTier } from '@/lib/types/ambassador';

function tierRange(tier: MilestoneTier) {
  return tier.maxRegistrations ? `${tier.minRegistrations}-${tier.maxRegistrations} registrations` : `${tier.minRegistrations}+ registrations`;
}

interface CampaignDetailsSheetProps {
  campaign: AvailableCampaignItem | null;
  onClose: () => void;
  onApply: (campaignId: string) => Promise<void>;
}

/**
 * The "see it before you apply" step the flat Available-Campaigns row was missing — opened
 * from a card click instead of Apply firing immediately. Reads the same public-safe preview
 * slice (rewardConfig + timeline) the campaign card list now carries; Apply lives here as the
 * single confirming action rather than on the list row.
 */
export function CampaignDetailsSheet({ campaign, onClose, onApply }: CampaignDetailsSheetProps) {
  const [applying, setApplying] = useState(false);
  const milestoneTiers = campaign?.rewardConfig.milestoneTiers ?? [];
  const speedBonus = campaign?.rewardConfig.speedBonus;
  const topSpeedBonusTier = speedBonus?.enabled ? speedBonus.tiers[0] : undefined;

  const handleApply = async () => {
    if (!campaign) return;
    setApplying(true);
    try {
      await onApply(campaign.id);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Sheet open={!!campaign} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{campaign?.name}</SheetTitle>
          {campaign && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="font-normal">
                {campaign.organizationName}
              </Badge>
              <span className="text-xs text-muted-foreground">{campaign.contestTitle}</span>
            </div>
          )}
        </SheetHeader>

        {campaign && (
          <div className="px-4 space-y-5">
            <CampaignTimelineStrip status={campaign.status} endDate={campaign.endDate} phases={campaign.phases} />

            {campaign.ambassadorTypesAllowed.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {campaign.ambassadorTypesAllowed.map((type) => (
                  <Badge key={type} variant="outline" className="font-normal text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            )}

            {milestoneTiers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">What you&apos;ll earn</p>
                <Card className="border-border/50">
                  <CardContent className="py-1 px-5 divide-y divide-border">
                    {milestoneTiers.map((tier, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-3.5">
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-foreground">{tier.label ?? `Tier ${i + 1}`}</span>
                          <p className="text-xs text-muted-foreground">{tierRange(tier)}</p>
                        </div>
                        <p className="text-sm font-semibold text-foreground text-right shrink-0">
                          <Rupees amount={tier.amountPerRegistration} />/reg{tier.goodie ? ` + ${tier.goodie.label}` : ''}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {topSpeedBonusTier && (
              <Card className="border-border/50">
                <CardContent className="py-3.5 flex items-center gap-3">
                  <Zap className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      +<Rupees amount={topSpeedBonusTier.bonusAmount} /> speed bonus
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {topSpeedBonusTier.label} — hit the milestone within {topSpeedBonusTier.withinDays} days of starting
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {milestoneTiers.length === 0 && !topSpeedBonusTier && (
              <p className="text-sm text-muted-foreground">
                The organizer hasn&apos;t published reward details for this campaign yet.
              </p>
            )}
          </div>
        )}

        <SheetFooter>
          <Button onClick={handleApply} disabled={applying} className="w-full">
            {applying ? 'Applying…' : 'Apply to this campaign'}
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
