'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, BookmarkPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SaveAsTemplateModal } from '../../SaveAsTemplateModal';
import type { FieldErrorMap } from '../../campaign-schema';
import { calculateCampaignCapacity } from '../../campaign-capacity';
import { Rupees } from '../../Rupees';
import { stepForErrorPath, stepLabel, type StepKey, type WizardDraft } from '../wizard-types';
import type { AmbassadorGroupInput } from '@/lib/types/ambassador';

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function ReviewPublishStep({
  campaignId,
  draft,
  groups,
  contestTitle,
  publishing,
  publishErrors,
  onGoToStep,
  onPublish,
}: {
  campaignId?: string;
  draft: WizardDraft;
  groups: AmbassadorGroupInput[];
  contestTitle: string | null;
  publishing: boolean;
  /** dot-path -> message, straight from ApiRequestError.details on a failed publish call */
  publishErrors: FieldErrorMap | null;
  onGoToStep: (step: StepKey) => void;
  onPublish: () => void;
}) {
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const errorEntries = publishErrors ? Object.entries(publishErrors) : [];
  const capacity = calculateCampaignCapacity(groups);

  const speedBonusBudget = draft.rewardConfig.speedBonus?.enabled
    ? (draft.rewardConfig.speedBonus.tiers ?? []).reduce(
        (acc, t) => acc + (t.maxWinners ? t.maxWinners * t.bonusAmount : t.bonusAmount),
        0,
      )
    : 0;

  const leaderboardBudget = (draft.rewardConfig.leaderboardPrizes ?? []).reduce((accCut, cut) => {
    const rankSum = (cut.ranks ?? []).reduce((accRank, r) => {
      const cash = r.cashAmount ?? 0;
      const goodie = r.goodie?.cashEquivalent ?? 0;
      return accRank + cash + goodie;
    }, 0);
    const consolationSum = (cut.consolation?.cashAmount ?? 0);
    return accCut + rankSum + consolationSum;
  }, 0);

  const totalPrizeInvestment = speedBonusBudget + leaderboardBudget;

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Campaign Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <SummaryRow label="Campaign name" value={draft.name || '—'} />
          <SummaryRow label="Promoting" value={contestTitle ?? '—'} />
          <SummaryRow label="Ambassador types" value={draft.ambassadorTypesAllowed.join(', ') || '—'} />
          <SummaryRow
            label="Ambassador structure"
            value={capacity.groupCount ? `${capacity.groupCount} groups, ${capacity.totalAmbassadorTarget} ambassadors (~${capacity.totalRegistrationTarget.toLocaleString()} target regs)` : 'Not defined'}
          />
          <SummaryRow label="Milestone tiers" value={String(draft.rewardConfig.milestoneTiers?.length ?? 0)} />
          <SummaryRow label="Speed bonus" value={draft.rewardConfig.speedBonus?.enabled ? 'Enabled' : 'Not set'} />
          <SummaryRow label="Leaderboards" value={String(draft.rewardConfig.leaderboardPrizes?.length ?? 0)} />
          <SummaryRow
            label="Timeline"
            value={
              draft.startDate && draft.endDate
                ? `${new Date(draft.startDate).toLocaleDateString()} – ${new Date(draft.endDate).toLocaleDateString()}`
                : 'Not set'
            }
          />
        </CardContent>
      </Card>

      {totalPrizeInvestment > 0 && (
        <Card className="border-border/50 bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Estimated Investment Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {speedBonusBudget > 0 && (
              <SummaryRow label="Speed Bonus Budget" value={<Rupees amount={speedBonusBudget} />} />
            )}
            {leaderboardBudget > 0 && (
              <SummaryRow label="Leaderboard Prizes Budget" value={<Rupees amount={leaderboardBudget} />} />
            )}
            <div className="pt-2 font-semibold">
              <SummaryRow label="Est. Total Prize/Bonus Investment" value={<Rupees amount={totalPrizeInvestment} />} />
            </div>
          </CardContent>
        </Card>
      )}

      {errorEntries.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Fix before publishing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {errorEntries.map(([path, message]) => {
              const step = stepForErrorPath(path);
              return (
                <div key={path} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-destructive">{message}</span>
                  <Button size="sm" variant="outline" onClick={() => onGoToStep(step)}>
                    Go to {stepLabel(step)}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button disabled={publishing} onClick={onPublish} className="w-full sm:w-auto">
          {publishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Publish Campaign
        </Button>
        {campaignId && (
          <Button variant="outline" onClick={() => setSaveTemplateOpen(true)} className="w-full sm:w-auto">
            <BookmarkPlus className="h-4 w-4 mr-2" />
            Save as Template
          </Button>
        )}
      </div>

      {campaignId && (
        <SaveAsTemplateModal
          campaignId={campaignId}
          campaignName={draft.name}
          open={saveTemplateOpen}
          onOpenChange={setSaveTemplateOpen}
        />
      )}
    </div>
  );
}

