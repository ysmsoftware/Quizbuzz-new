'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Rupees } from './Rupees';
import { leaderboardScopeKey } from '@/lib/types/ambassador';
import type { CampaignStats } from '@/lib/types/ambassador';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, QrCode } from 'lucide-react';

interface RankRewardCardsProps {
  stats: CampaignStats;
  referralLink?: string;
  onOpenQr?: () => void;
}

export function RankRewardCards({ stats, referralLink, onOpenQr }: RankRewardCardsProps) {
  const rankEntries = stats.leaderboardRanks.filter((r) => r.rank !== null);
  const nextTier = stats.nextTier;

  if (rankEntries.length === 0 && !nextTier && !referralLink) return null;

  return (
    <Card className="border-border/50 py-4 gap-0">
      {rankEntries.length > 0 && (
        <CardContent className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your rank</p>
          {rankEntries.map((rankEntry) => (
            <div key={leaderboardScopeKey(rankEntry.scope)} className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground truncate">{rankEntry.label}</span>
              <span className="text-lg font-bold text-foreground shrink-0">#{rankEntry.rank}</span>
            </div>
          ))}
        </CardContent>
      )}
      {nextTier && (
        <CardContent className={rankEntries.length > 0 ? 'pt-3 mt-3 border-t border-border/40' : undefined}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Next reward</p>
          <p className="text-xl font-bold text-foreground"><Rupees amount={nextTier.amountPerRegistration} /><span className="text-sm font-normal text-muted-foreground"> /registration</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">
            at {nextTier.label ?? 'the next tier'}{nextTier.goodie ? ` · plus ${nextTier.goodie.label}` : ''}
          </p>
        </CardContent>
      )}
      {referralLink && onOpenQr && (
        <CardContent className={rankEntries.length > 0 || nextTier ? 'pt-3 mt-3 border-t border-border/40' : undefined}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Referral QR</p>
              <p className="text-xs text-muted-foreground">Tap to expand & share</p>
            </div>
            <button
              type="button"
              onClick={onOpenQr}
              className="flex items-center gap-2 p-1.5 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted/80 transition-colors group cursor-pointer"
              title="Click to view & download QR Code"
            >
              <div className="rounded-md bg-white p-1 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <QRCodeSVG value={referralLink} size={34} bgColor="#ffffff" fgColor="#09090b" level="M" />
              </div>
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground mr-0.5" />
            </button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
