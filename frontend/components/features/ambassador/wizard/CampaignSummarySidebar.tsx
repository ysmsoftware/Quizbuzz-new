'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateCampaignCapacity } from '../campaign-capacity';
import type { WizardDraft } from './wizard-types';
import type { AmbassadorGroupInput } from '@/lib/types/ambassador';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export function CampaignSummarySidebar({
  draft,
  groups,
  contestTitle,
}: {
  draft: WizardDraft;
  groups: AmbassadorGroupInput[];
  contestTitle: string | null;
}) {
  const tierCount = draft.rewardConfig.milestoneTiers?.length ?? 0;
  const leaderboardCount = draft.rewardConfig.leaderboardPrizes?.length ?? 0;
  const speedBonusOn = draft.rewardConfig.speedBonus?.enabled ? 'On' : 'Off';
  const kitFilled = [draft.shareTemplates.whatsappText, draft.shareTemplates.instagramText, draft.shareTemplates.posterImageUrl].filter(Boolean).length;
  const capacity = calculateCampaignCapacity(groups);

  // Calculate Speed Bonus Total
  const speedBonusBudgetPaise = draft.rewardConfig.speedBonus?.enabled
    ? (draft.rewardConfig.speedBonus.tiers ?? []).reduce(
        (acc, t) => acc + (t.maxWinners ? t.maxWinners * t.bonusAmount : t.bonusAmount),
        0,
      )
    : 0;

  // Calculate Leaderboards Total
  const leaderboardBudgetPaise = (draft.rewardConfig.leaderboardPrizes ?? []).reduce((accCut, cut) => {
    const rankSum = (cut.ranks ?? []).reduce((accRank, r) => {
      const cash = r.cashAmount ?? 0;
      const goodie = r.goodie?.cashEquivalent ?? 0;
      return accRank + cash + goodie;
    }, 0);
    const consolationSum = (cut.consolation?.cashAmount ?? 0);
    return accCut + rankSum + consolationSum;
  }, 0);

  const totalEstimatedInvestmentRupees = Math.round((speedBonusBudgetPaise + leaderboardBudgetPaise) / 100);

  return (
    <Card className="border-border/50 sticky top-4">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Campaign Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row label="Name" value={draft.name || '—'} />
        <Row label="Promoting" value={contestTitle ?? '—'} />
        <Row label="Ambassador types" value={draft.ambassadorTypesAllowed.length ? String(draft.ambassadorTypesAllowed.length) : '—'} />
        <Row label="Ambassador groups" value={capacity.groupCount ? String(capacity.groupCount) : '—'} />
        {capacity.groupCount > 0 && <Row label="Est. registrations" value={capacity.totalRegistrationTarget.toLocaleString()} />}
        <Row label="Milestone tiers" value={tierCount ? String(tierCount) : '—'} />
        <Row label="Speed bonus" value={speedBonusOn} />
        <Row label="Leaderboards" value={leaderboardCount ? String(leaderboardCount) : '—'} />
        {totalEstimatedInvestmentRupees > 0 && (
          <div className="pt-2 border-t border-border/40">
            <Row label="Est. Prize/Bonus Cost" value={`₹${totalEstimatedInvestmentRupees.toLocaleString('en-IN')}`} />
          </div>
        )}
        <Row
          label="Timeline"
          value={draft.startDate && draft.endDate ? `${new Date(draft.startDate).toLocaleDateString()} – ${new Date(draft.endDate).toLocaleDateString()}` : '—'}
        />
        <Row label="Ambassador kit" value={kitFilled ? `${kitFilled} of 3 filled` : '—'} />
      </CardContent>
    </Card>
  );
}
