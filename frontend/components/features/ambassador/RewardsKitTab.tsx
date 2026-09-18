'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Gift } from 'lucide-react';
import { CopyIconButton } from './CopyIconButton';
import Image from 'next/image';
import { Rupees } from './Rupees';
import { GoodieHoverCard } from './GoodieHoverCard';
import { onImageError } from '@/lib/utils/image';
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
  const kitItems = shareTemplates.kits?.length
    ? shareTemplates.kits
        .filter((k) => k.templateText)
        .map((k) => ({
          label: k.name,
          sub: k.description || 'Share Kit Template',
          text: k.templateText.replace(/\{referralLink\}/g, referralLink),
        }))
    : [
        ...(shareTemplates.whatsappTemplates?.length
          ? shareTemplates.whatsappTemplates.map((t) => ({
              label: t.label,
              sub: 'WhatsApp template',
              text: t.text.replace(/\{referralLink\}/g, referralLink),
            }))
          : shareTemplates.whatsappText
            ? [
                {
                  label: 'WhatsApp message',
                  sub: 'Share template',
                  text: shareTemplates.whatsappText.replace(/\{referralLink\}/g, referralLink),
                },
              ]
            : []),
        ...(shareTemplates.instagramText
          ? [
              {
                label: 'Instagram caption',
                sub: 'Text template',
                text: shareTemplates.instagramText.replace(/\{referralLink\}/g, referralLink),
              },
            ]
          : []),
      ];

  return (
    <div className="space-y-5">
      {milestoneTiers.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="py-1 px-5 divide-y divide-border">
            {milestoneTiers.map((tier, i) => {
              const isCurrent = currentTier?.minRegistrations === tier.minRegistrations;
              const row = (
                <div className={`flex items-center justify-between gap-3 py-3.5 ${tier.goodie ? 'cursor-default' : ''}`}>
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
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground text-right shrink-0">
                    {tier.goodie?.imageUrl && (
                      <span className="relative inline-block h-5 w-5 shrink-0">
                        <Image src={tier.goodie.imageUrl} alt="" fill sizes="20px" onError={onImageError} className="rounded object-cover border border-border/50" />
                      </span>
                    )}
                    <span><Rupees amount={tier.amountPerRegistration} />/reg{tier.goodie ? ` + ${tier.goodie.label}` : ''}</span>
                  </p>
                </div>
              );
              return (
                <div key={i}>
                  {tier.goodie ? <GoodieHoverCard goodie={tier.goodie}>{row}</GoodieHoverCard> : row}
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
                  <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
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
