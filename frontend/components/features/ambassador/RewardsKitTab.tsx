'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Gift } from 'lucide-react';
import { CopyIconButton } from './CopyIconButton';
import { Rupees } from './Rupees';
import type { CampaignStats, MilestoneTier, ShareTemplates } from '@/lib/types/ambassador';

function tierRange(tier: MilestoneTier) {
  return tier.maxRegistrations ? `${tier.minRegistrations}-${tier.maxRegistrations} registrations` : `${tier.minRegistrations}+ registrations`;
}

interface RewardsKitTabProps {
  milestoneTiers: MilestoneTier[];
  currentTier: CampaignStats['currentTier'];
  shareTemplates: ShareTemplates;
  referralLink: string;
}

export function RewardsKitTab({ milestoneTiers, currentTier, shareTemplates, referralLink }: RewardsKitTabProps) {
  const templates = shareTemplates.whatsappTemplates?.length
    ? shareTemplates.whatsappTemplates
    : shareTemplates.whatsappText
      ? [{ id: 'primary', label: 'WhatsApp message', text: shareTemplates.whatsappText, includePoster: false }]
      : [];

  const kitItems = [
    ...templates.map((t) => ({ label: t.label, sub: 'WhatsApp template', text: t.text.replace('{referralLink}', referralLink) })),
    ...(shareTemplates.instagramText
      ? [{ label: 'Instagram caption', sub: 'Text template', text: shareTemplates.instagramText.replace('{referralLink}', referralLink) }]
      : []),
  ];

  return (
    <div className="space-y-5">
      {milestoneTiers.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="py-1 px-5 divide-y divide-border">
            {milestoneTiers.map((tier, i) => {
              const isCurrent = currentTier?.minRegistrations === tier.minRegistrations;
              return (
                <div key={i} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{tier.label ?? `Tier ${i + 1}`}</span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                          current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{tierRange(tier)}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground text-right shrink-0">
                    <Rupees amount={tier.amountPerRegistration} />/reg{tier.goodie ? ` + ${tier.goodie.label}` : ''}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {kitItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {kitItems.map((item, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="py-3.5 px-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
                <CopyIconButton text={item.text} label={`${item.label} copied`} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyMedia variant="icon">
            <Gift className="h-5 w-5" />
          </EmptyMedia>
          <EmptyTitle>No kit assets yet</EmptyTitle>
          <EmptyDescription>The organizer hasn&apos;t added share templates for this campaign.</EmptyDescription>
        </Empty>
      )}
    </div>
  );
}
