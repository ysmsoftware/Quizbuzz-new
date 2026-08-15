'use client';

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RepeatingRowTable, type RepeatingRowColumn } from './RepeatingRowTable';
import { Rupees } from './Rupees';
import { addWeeksIso } from './campaign-timeline';
import { cn } from '@/lib/utils';
import type { FieldErrorMap } from './campaign-schema';
import type { SpeedBonusConfig, SpeedBonusStartMode } from '@/lib/types/ambassador';

/** Flat row shape — see MilestoneTiersEditor for why `goodie` is split into two flat
 * columns here and reassembled on change. Gives speed-bonus tiers (Fast Starter, Early
 * Finisher, …) the same optional non-cash reward as milestone tiers. */
interface SpeedBonusRow {
  withinDays: number;
  bonusAmount: number;
  label: string;
  maxWinners: number;
  goodieLabel: string;
  goodieCashEquivalent: number;
}

const COLUMNS: RepeatingRowColumn<SpeedBonusRow>[] = [
  { key: 'withinDays', label: 'Within Days', type: 'number' },
  { key: 'bonusAmount', label: 'Bonus Amount (₹)', type: 'number' },
  { key: 'label', label: 'Label', type: 'text', placeholder: 'Fast Starter' },
  { key: 'maxWinners', label: 'Max Winners (optional)', type: 'number', placeholder: '10' },
  { key: 'goodieLabel', label: 'Goodie (optional)', type: 'text', placeholder: 'Badge, merch…' },
  { key: 'goodieCashEquivalent', label: 'Goodie Value (₹, optional)', type: 'number' },
];

const EMPTY: SpeedBonusConfig = { enabled: false, milestoneThreshold: 0, tiers: [] };
const PREFIX = 'rewardConfig.speedBonus';

export function SpeedBonusEditor({
  value,
  onChange,
  contestRegistrationStartDate,
  errors = {},
}: {
  value: SpeedBonusConfig | undefined;
  onChange: (value: SpeedBonusConfig | undefined) => void;
  /** The promoted contest's registration-open date (ISO), once one's been picked in the
   *  Promotion step — powers the "same as contest start" / "N weeks after" modes below.
   *  Undefined until a contest is selected. */
  contestRegistrationStartDate?: string;
  errors?: FieldErrorMap;
}) {
  const speedBonus = value ?? EMPTY;
  const startMode: SpeedBonusStartMode = speedBonus.campaignStartAtMode ?? 'CONTEST_START';
  const offsetWeeks = speedBonus.campaignStartAtOffsetWeeks ?? 0;

  // Reacting to the contest changing *while this editor isn't mounted* (e.g. the admin
  // reselects the promoted quiz from the Promotion step without ever revisiting Rewards) is
  // handled one level up, in CampaignWizard — this editor unmounts whenever the admin leaves
  // the Rewards step, so a sync effect living here would miss exactly that case. What's left
  // for this component is just the two handlers below, which write the resolved date
  // immediately whenever the admin explicitly interacts with the mode/offset controls.

  const setStartMode = (nextMode: SpeedBonusStartMode) => {
    if (nextMode !== 'CUSTOM' && contestRegistrationStartDate) {
      const resolved = nextMode === 'OFFSET_WEEKS' ? addWeeksIso(contestRegistrationStartDate, offsetWeeks) : contestRegistrationStartDate;
      onChange({ ...speedBonus, campaignStartAtMode: nextMode, campaignStartAt: resolved });
    } else {
      onChange({ ...speedBonus, campaignStartAtMode: nextMode });
    }
  };

  const setOffsetWeeks = (weeks: number) => {
    const resolved = contestRegistrationStartDate ? addWeeksIso(contestRegistrationStartDate, weeks) : speedBonus.campaignStartAt;
    onChange({ ...speedBonus, campaignStartAtMode: 'OFFSET_WEEKS', campaignStartAtOffsetWeeks: weeks, campaignStartAt: resolved });
  };

  const rows: SpeedBonusRow[] = speedBonus.tiers.map((t) => ({
    withinDays: t.withinDays,
    bonusAmount: t.bonusAmount,
    label: t.label,
    maxWinners: t.maxWinners ?? 0,
    goodieLabel: t.goodie?.label ?? '',
    goodieCashEquivalent: t.goodie?.cashEquivalent ?? 0,
  }));

  const handleTiersChange = (nextRows: SpeedBonusRow[]) => {
    onChange({
      ...speedBonus,
      tiers: nextRows.map((r) => ({
        withinDays: r.withinDays,
        bonusAmount: r.bonusAmount,
        label: r.label.trim(),
        maxWinners: r.maxWinners || undefined,
        goodie: r.goodieLabel.trim()
          ? { label: r.goodieLabel.trim(), cashEquivalent: r.goodieCashEquivalent || undefined }
          : undefined,
      })),
    });
  };

  const totalSpeedBudget = rows.reduce(
    (sum, r) => sum + (r.maxWinners > 0 ? r.maxWinners * r.bonusAmount : r.bonusAmount),
    0,
  );

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div>
          <CardTitle className="text-base">Speed Bonus</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Decaying time-linked bonus starting automatically when the campaign goes live.
          </p>
        </div>
        <CardAction className="flex items-center gap-2">
          <Switch
            checked={speedBonus.enabled}
            onCheckedChange={(checked) => onChange({ ...speedBonus, enabled: checked })}
          />
          <Label className="text-sm text-muted-foreground">Enabled</Label>
        </CardAction>
      </CardHeader>
      {speedBonus.enabled && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Speed Bonus Start</Label>
            <p className="text-xs text-muted-foreground">
              The clock &quot;Within Days&quot; counts from below — when ambassadors are expected to start earning
              speed-bonus registrations.
            </p>
            <RadioGroup value={startMode} onValueChange={(v) => setStartMode(v as SpeedBonusStartMode)} className="gap-2.5 pt-1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="CONTEST_START" id="sb-start-contest" disabled={!contestRegistrationStartDate} />
                <Label htmlFor="sb-start-contest" className={cn('font-normal cursor-pointer', !contestRegistrationStartDate && 'text-muted-foreground')}>
                  Same as the quiz&apos;s registration start date
                </Label>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <RadioGroupItem value="OFFSET_WEEKS" id="sb-start-offset" disabled={!contestRegistrationStartDate} />
                <Label htmlFor="sb-start-offset" className={cn('font-normal cursor-pointer', !contestRegistrationStartDate && 'text-muted-foreground')}>
                  Weeks after the quiz&apos;s registration start
                </Label>
                <Input
                  type="number"
                  min={0}
                  aria-label="Weeks after registration start"
                  value={offsetWeeks || ''}
                  disabled={startMode !== 'OFFSET_WEEKS' || !contestRegistrationStartDate}
                  onChange={(e) => setOffsetWeeks(Number(e.target.value) || 0)}
                  className="h-8 w-16"
                />
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="CUSTOM" id="sb-start-custom" />
                <Label htmlFor="sb-start-custom" className="font-normal cursor-pointer">
                  Custom date
                </Label>
              </div>
            </RadioGroup>

            {!contestRegistrationStartDate && startMode !== 'CUSTOM' && (
              <p className="text-xs text-muted-foreground">
                Select a quiz to promote in the Promotion step to use this option, or pick a custom date above.
              </p>
            )}

            {startMode === 'CUSTOM' ? (
              <DatePicker
                value={speedBonus.campaignStartAt ? new Date(speedBonus.campaignStartAt) : undefined}
                onChange={(date) => onChange({ ...speedBonus, campaignStartAtMode: 'CUSTOM', campaignStartAt: date?.toISOString() })}
                className={cn('max-w-xs', errors[`${PREFIX}.campaignStartAt`] && 'border-destructive')}
              />
            ) : (
              speedBonus.campaignStartAt && (
                <p className="text-xs text-muted-foreground">Resolves to {new Date(speedBonus.campaignStartAt).toLocaleDateString()}.</p>
              )
            )}

            {errors[`${PREFIX}.campaignStartAt`] && <p className="text-xs text-destructive">{errors[`${PREFIX}.campaignStartAt`]}</p>}
          </div>

          <div className="space-y-2">
            <Label>Milestone Threshold (Registrations required for speed bonus)</Label>
            <Input
              type="number"
              value={speedBonus.milestoneThreshold || ''}
              placeholder="e.g. 100"
              onChange={(e) => onChange({ ...speedBonus, milestoneThreshold: Number(e.target.value) })}
              aria-invalid={!!errors[`${PREFIX}.milestoneThreshold`]}
              className={cn('max-w-xs', errors[`${PREFIX}.milestoneThreshold`] && 'border-destructive focus-visible:ring-destructive/20')}
            />
            {errors[`${PREFIX}.milestoneThreshold`] && (
              <p className="text-xs text-destructive">{errors[`${PREFIX}.milestoneThreshold`]}</p>
            )}
          </div>

          <RepeatingRowTable
            rows={rows}
            columns={COLUMNS}
            addLabel="Add bonus tier"
            onChange={handleTiersChange}
            arrayError={errors[`${PREFIX}.tiers`]}
            getCellError={(index, key) => {
              const k = String(key);
              const baseKey = `${PREFIX}.tiers.${index}.${k}`;
              if (k === 'goodieLabel') {
                return errors[`${PREFIX}.tiers.${index}.goodie.label`] || errors[`${PREFIX}.tiers.${index}.goodie`] || errors[baseKey];
              }
              if (k === 'goodieCashEquivalent') {
                return errors[`${PREFIX}.tiers.${index}.goodie.cashEquivalent`] || errors[`${PREFIX}.tiers.${index}.goodie`] || errors[baseKey];
              }
              return errors[baseKey];
            }}
            newRow={() => ({ withinDays: 7, bonusAmount: 0, label: '', maxWinners: 0, goodieLabel: '', goodieCashEquivalent: 0 })}
          />

          {rows.length > 0 && (
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Estimated Speed Bonus Budget:</span>
              <span className="font-semibold text-foreground">
                <Rupees amount={totalSpeedBudget} />
              </span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
