'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { calculateCampaignCapacity } from '../campaign-capacity';
import { Rupees } from '../Rupees';
import { WIZARD_STEPS, type StepKey, type WizardDraft } from './wizard-types';
import type { AmbassadorGroupInput } from '@/lib/types/ambassador';

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] py-1.5 border-b border-border/20 last:border-none">
      <span className="text-muted-foreground/90 font-medium">{label}</span>
      <span className="font-semibold text-foreground text-right max-w-[150px] truncate">{value}</span>
    </div>
  );
}

export function CampaignSummarySidebar({
  draft,
  groups,
  contestTitle,
  currentStepKey,
}: {
  draft: WizardDraft;
  groups: AmbassadorGroupInput[];
  contestTitle: string | null;
  currentStepKey?: StepKey;
}) {
  const tierCount = draft.rewardConfig.milestoneTiers?.length ?? 0;
  const leaderboardCount = draft.rewardConfig.leaderboardPrizes?.length ?? 0;
  const speedBonusOn = draft.rewardConfig.speedBonus?.enabled ? 'Active' : 'Inactive';
  const kitFilled = [draft.shareTemplates.whatsappText, draft.shareTemplates.instagramText, draft.shareTemplates.posterImageUrl].filter(Boolean).length;
  const capacity = calculateCampaignCapacity(groups);

  // Calculate Speed Bonus Total
  const speedBonusBudget = draft.rewardConfig.speedBonus?.enabled
    ? (draft.rewardConfig.speedBonus.tiers ?? []).reduce(
        (acc: number, t) => acc + (t.maxWinners ? t.maxWinners * t.bonusAmount : t.bonusAmount),
        0,
      )
    : 0;

  // Calculate Leaderboards Total
  const leaderboardBudget = (draft.rewardConfig.leaderboardPrizes ?? []).reduce((accCut: number, cut) => {
    const rankSum = (cut.ranks ?? []).reduce((accRank: number, r) => {
      const cash = r.cashAmount ?? 0;
      const goodie = r.goodie?.cashEquivalent ?? 0;
      return accRank + cash + goodie;
    }, 0);
    const consolationSum = (cut.consolation?.cashAmount ?? 0);
    return accCut + rankSum + consolationSum;
  }, 0);

  const totalEstimatedInvestment = speedBonusBudget + leaderboardBudget;

  // Calculate Progress
  const currentStepIndex = currentStepKey ? WIZARD_STEPS.findIndex((s) => s.key === currentStepKey) : 0;
  const progressPercent = Math.round(((currentStepIndex + 1) / WIZARD_STEPS.length) * 100);

  return (
    <Card className="border-border/50 shadow-sm sticky top-6 bg-card/40 backdrop-blur-md overflow-hidden">
      {/* Decorative top border gradient */}
      <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
      
      <CardHeader className="pb-4 pt-5 px-5">
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            Campaign Summary
          </CardTitle>
          <Badge variant="outline" className="text-[10px] font-bold py-0.5 px-2 bg-primary/5 text-primary border-primary/20">
            {currentStepIndex + 1} of {WIZARD_STEPS.length}
          </Badge>
        </div>
        <div className="space-y-1.5">
          <Progress value={progressPercent} className="h-1.5 bg-muted/60" />
          <p className="text-[10px] text-muted-foreground/80 font-medium text-right">{progressPercent}% complete</p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 px-5 pb-5">
        <div className="space-y-0.5">
          <Row label="Campaign Name" value={draft.name || '—'} />
          <Row label="Promoting Contest" value={contestTitle ?? '—'} />
          <Row label="Ambassador Types" value={draft.ambassadorTypesAllowed.length ? `${draft.ambassadorTypesAllowed.length} type${draft.ambassadorTypesAllowed.length === 1 ? '' : 's'}` : '—'} />
          <Row label="Groups Configured" value={capacity.groupCount ? `${capacity.groupCount} group${capacity.groupCount === 1 ? '' : 's'}` : '—'} />
          {capacity.groupCount > 0 && (
            <Row label="Target Registrations" value={capacity.totalRegistrationTarget.toLocaleString()} />
          )}
          <Row label="Milestone Tiers" value={tierCount ? `${tierCount} tier${tierCount === 1 ? '' : 's'}` : '—'} />
          <Row 
            label="Speed Bonus" 
            value={
              draft.rewardConfig.speedBonus?.enabled ? (
                <span className="text-primary font-bold">{speedBonusOn}</span>
              ) : (
                <span className="text-muted-foreground/60">{speedBonusOn}</span>
              )
            } 
          />
          <Row label="Leaderboards" value={leaderboardCount ? `${leaderboardCount} active` : '—'} />
          <Row
            label="Dates & Timeline"
            value={
              draft.startDate && draft.endDate ? (
                <span className="text-xs font-semibold">
                  {new Date(draft.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
                  {new Date(draft.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                </span>
              ) : (
                '—'
              )
            }
          />
          <Row label="Ambassador Kit" value={kitFilled ? `${kitFilled}/3 elements` : '—'} />
        </div>

        {totalEstimatedInvestment > 0 && (
          <div className="pt-4 border-t border-border/50 flex flex-col gap-2 bg-gradient-to-br from-primary/[0.02] to-transparent p-3.5 rounded-xl border border-primary/10">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Estimated Budget</span>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-foreground/80">Prize/Bonus Total</span>
              <span className="text-lg font-black text-primary leading-none">
                <Rupees amount={totalEstimatedInvestment} />
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
