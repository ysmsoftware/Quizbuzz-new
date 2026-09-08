'use client';

import { Trophy, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Rupees } from './Rupees';
import type {
  AmbassadorCampaignStatus,
  CampaignSpeedBonusStatus,
  LeaderboardCut,
  LeaderboardRankEntry,
  TierBracketBreakdown,
} from '@/lib/types/ambassador';

/** Same rank -> prize lookup as the backend's findPrizeForRank (campaign-stats.ts) — an exact
 *  rank match first, then a range, then the cut's consolation prize. Kept here rather than a
 *  network round trip since campaign.leaderboardPrizes + this ambassador's rank are already
 *  on the page. */
function findPrizeForRank(cut: LeaderboardCut, rank: number): LeaderboardCut['ranks'][number] | null {
  const exact = cut.ranks.find((r) => r.rank === rank);
  if (exact) return exact;
  const ranged = cut.ranks.find((r) => r.rankRange && rank >= r.rankRange[0] && rank <= r.rankRange[1]);
  if (ranged) return ranged;
  if (cut.consolation) return { label: cut.consolation.label, cashAmount: cut.consolation.cashAmount };
  return null;
}

interface EarningsBreakdownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrationCount: number;
  milestoneAmount: number;
  tierBreakdown: TierBracketBreakdown[];
  speedBonus: CampaignSpeedBonusStatus | null;
  campaignStatus: AmbassadorCampaignStatus;
  leaderboardRanks: LeaderboardRankEntry[];
  leaderboardPrizes: LeaderboardCut[];
}

/** The full bifurcation behind the tier-ladder's headline number: what each registration
 *  bracket paid (so a rate change between tiers is visible), the speed bonus if one was
 *  earned, and — only once the campaign has actually ended, since ranks can still move
 *  before that — what this ambassador's final leaderboard placements are worth. The ladder
 *  headline itself only ever shows the plain registrations x rate figure; everything else
 *  lives here. */
export function EarningsBreakdownModal({
  open,
  onOpenChange,
  registrationCount,
  milestoneAmount,
  tierBreakdown,
  speedBonus,
  campaignStatus,
  leaderboardRanks,
  leaderboardPrizes,
}: EarningsBreakdownModalProps) {
  const speedBonusAmount = speedBonus?.earned
    ? (speedBonus.tier?.bonusAmount ?? 0) + (speedBonus.tier?.goodie?.cashEquivalent ?? 0)
    : 0;

  const campaignEnded = campaignStatus === 'ENDED' || campaignStatus === 'ARCHIVED';
  const cutByScope = new Map(leaderboardPrizes.map((c) => [JSON.stringify(c.scope), c]));
  const rankRewards = campaignEnded
    ? leaderboardRanks
        .filter((r) => r.rank !== null)
        .map((r) => {
          const cut = cutByScope.get(JSON.stringify(r.scope));
          const prize = cut ? findPrizeForRank(cut, r.rank!) : null;
          return prize ? { label: r.label, rank: r.rank!, prize } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null && !!x.prize.cashAmount)
    : [];
  const leaderboardAmount = rankRewards.reduce((sum, r) => sum + (r.prize.cashAmount ?? 0), 0);

  const grandTotal = milestoneAmount + speedBonusAmount + leaderboardAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your total earnings</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Registration rewards · {registrationCount} total
            </p>
            <div className="space-y-2">
              {tierBreakdown.map((b, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{b.tierLabel}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {b.registrationsInBracket} reg{b.registrationsInBracket === 1 ? '' : 's'} × <Rupees amount={b.amountPerRegistration} />
                      {b.goodieCashEquivalent ? ` + ${b.goodieLabel}` : ''}
                    </p>
                  </div>
                  <p className="font-semibold text-foreground tabular-nums shrink-0"><Rupees amount={b.subtotal} /></p>
                </div>
              ))}
              {tierBreakdown.length === 0 && <p className="text-xs text-muted-foreground">No registrations yet.</p>}
            </div>
            <div className="flex items-center justify-between gap-3 text-sm pt-2 mt-2 border-t border-border/60">
              <p className="font-semibold text-foreground">Subtotal</p>
              <p className="font-bold text-foreground tabular-nums"><Rupees amount={milestoneAmount} /></p>
            </div>
          </div>

          {speedBonus?.earned && speedBonus.tier && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-warning" />
                Speed bonus
              </p>
              <div className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{speedBonus.tier.label}</p>
                  {speedBonus.tier.goodie && <p className="text-xs text-muted-foreground">Includes {speedBonus.tier.goodie.label}</p>}
                </div>
                <p className="font-semibold text-foreground tabular-nums shrink-0"><Rupees amount={speedBonusAmount} /></p>
              </div>
            </div>
          )}

          {campaignEnded && rankRewards.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-warning" />
                Leaderboard prizes
              </p>
              <div className="space-y-2">
                {rankRewards.map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{r.label}</p>
                      <p className="text-xs text-muted-foreground">Rank #{r.rank}{r.prize.label ? ` — ${r.prize.label}` : ''}</p>
                    </div>
                    <p className="font-semibold text-foreground tabular-nums shrink-0"><Rupees amount={r.prize.cashAmount ?? 0} /></p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-3 border-t-2 border-border">
            <p className="font-bold text-foreground">Total earned</p>
            <p className="text-xl font-bold text-foreground tabular-nums"><Rupees amount={grandTotal} /></p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
