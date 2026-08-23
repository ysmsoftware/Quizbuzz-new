'use client';

import { Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Rupees } from './Rupees';
import type { CampaignStats, MilestoneTier } from '@/lib/types/ambassador';

function tierRange(tier: MilestoneTier) {
  return tier.maxRegistrations ? `${tier.minRegistrations}–${tier.maxRegistrations}` : `${tier.minRegistrations}+`;
}

interface RewardTiersCardProps {
  milestoneTiers: MilestoneTier[];
  currentTier: CampaignStats['currentTier'];
}

/** What each milestone pays out per registration, in full — the rate table underneath the
 *  ladder's at-a-glance version, separate from the ambassador kit below so reward economics
 *  and share assets aren't mixed together in one long tab. */
export function RewardTiersCard({ milestoneTiers, currentTier }: RewardTiersCardProps) {
  if (milestoneTiers.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent>
          <Empty className="py-8">
            <EmptyMedia variant="icon">
              <Layers className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle className="text-sm">No reward tiers configured</EmptyTitle>
            <EmptyDescription className="text-xs">The organizer hasn&apos;t set up milestone tiers for this campaign.</EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      {/* Below `lg`: stacked rows — a 4-column table has no room to breathe on a phone.
          At `lg`+: the original rate table. */}
      <CardContent className="px-5 py-1 lg:hidden divide-y divide-border">
        {milestoneTiers.map((tier, i) => {
          const isCurrent = currentTier?.minRegistrations === tier.minRegistrations;
          return (
            <div key={i} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
                  {tier.label ?? `Tier ${i + 1}`}
                  {isCurrent && (
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                      current
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{tierRange(tier)} registrations</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[12.5px] font-semibold text-foreground tabular-nums">
                  <Rupees amount={tier.amountPerRegistration} />
                  /reg
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{tier.goodie ? tier.goodie.label : '—'}</p>
              </div>
            </div>
          );
        })}
      </CardContent>

      <CardContent className="hidden lg:block px-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Tier</TableHead>
              <TableHead>Registrations</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead className="text-right pr-5">Bonus</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {milestoneTiers.map((tier, i) => {
              const isCurrent = currentTier?.minRegistrations === tier.minRegistrations;
              return (
                <TableRow key={i} className={cn(isCurrent && 'bg-primary/5')}>
                  <TableCell className="pl-5 font-semibold text-foreground">
                    <span className="flex items-center gap-2">
                      {tier.label ?? `Tier ${i + 1}`}
                      {isCurrent && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                          current
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{tierRange(tier)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    <Rupees amount={tier.amountPerRegistration} />
                    /reg
                  </TableCell>
                  <TableCell className="text-right pr-5 text-muted-foreground">{tier.goodie ? tier.goodie.label : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
