'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { RepeatingRowTable, type RepeatingRowColumn } from './RepeatingRowTable';
import { cn } from '@/lib/utils';
import type { FieldErrorMap } from './campaign-schema';
import type { SpeedBonusConfig } from '@/lib/types/ambassador';

/** Flat row shape — see MilestoneTiersEditor for why `goodie` is split into two flat
 * columns here and reassembled on change. Gives speed-bonus tiers (Fast Starter, Early
 * Finisher, …) the same optional non-cash reward as milestone tiers. */
interface SpeedBonusRow {
  withinDays: number;
  bonusAmount: number;
  label: string;
  goodieLabel: string;
  goodieCashEquivalent: number;
}

const COLUMNS: RepeatingRowColumn<SpeedBonusRow>[] = [
  { key: 'withinDays', label: 'Within Days', type: 'number' },
  { key: 'bonusAmount', label: 'Bonus Amount (paise)', type: 'number' },
  { key: 'label', label: 'Label', type: 'text', placeholder: 'Fast Starter' },
  { key: 'goodieLabel', label: 'Goodie (optional)', type: 'text', placeholder: 'Badge, merch…' },
  { key: 'goodieCashEquivalent', label: 'Goodie Value (paise, optional)', type: 'number' },
];

const EMPTY: SpeedBonusConfig = { enabled: false, campaignStartAt: '', milestoneThreshold: 0, tiers: [] };
const PREFIX = 'rewardConfig.speedBonus';

export function SpeedBonusEditor({
  value,
  onChange,
  errors = {},
}: {
  value: SpeedBonusConfig | undefined;
  onChange: (value: SpeedBonusConfig | undefined) => void;
  errors?: FieldErrorMap;
}) {
  const speedBonus = value ?? EMPTY;

  const rows: SpeedBonusRow[] = speedBonus.tiers.map((t) => ({
    withinDays: t.withinDays,
    bonusAmount: t.bonusAmount,
    label: t.label,
    goodieLabel: t.goodie?.label ?? '',
    goodieCashEquivalent: t.goodie?.cashEquivalent ?? 0,
  }));

  const handleTiersChange = (nextRows: SpeedBonusRow[]) => {
    onChange({
      ...speedBonus,
      tiers: nextRows.map((r) => ({
        withinDays: r.withinDays,
        bonusAmount: r.bonusAmount,
        label: r.label,
        goodie: r.goodieLabel
          ? { label: r.goodieLabel, cashEquivalent: r.goodieCashEquivalent || undefined }
          : undefined,
      })),
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Speed Bonus</CardTitle>
        <div className="flex items-center gap-2">
          <Switch
            checked={speedBonus.enabled}
            onCheckedChange={(checked) => onChange({ ...speedBonus, enabled: checked })}
          />
          <Label className="text-sm text-muted-foreground">Enabled</Label>
        </div>
      </CardHeader>
      {speedBonus.enabled && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Campaign Start</Label>
              <DatePicker
                value={speedBonus.campaignStartAt ? new Date(speedBonus.campaignStartAt) : undefined}
                onChange={(date) => onChange({ ...speedBonus, campaignStartAt: date?.toISOString() ?? '' })}
                className={cn(errors[`${PREFIX}.campaignStartAt`] && 'border-destructive')}
              />
              {errors[`${PREFIX}.campaignStartAt`] && (
                <p className="text-xs text-destructive">{errors[`${PREFIX}.campaignStartAt`]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Milestone Threshold</Label>
              <Input
                type="number"
                value={speedBonus.milestoneThreshold}
                onChange={(e) => onChange({ ...speedBonus, milestoneThreshold: Number(e.target.value) })}
                aria-invalid={!!errors[`${PREFIX}.milestoneThreshold`]}
                className={cn(errors[`${PREFIX}.milestoneThreshold`] && 'border-destructive focus-visible:ring-destructive/20')}
              />
              {errors[`${PREFIX}.milestoneThreshold`] && (
                <p className="text-xs text-destructive">{errors[`${PREFIX}.milestoneThreshold`]}</p>
              )}
            </div>
          </div>

          <RepeatingRowTable
            rows={rows}
            columns={COLUMNS}
            addLabel="Add bonus tier"
            onChange={handleTiersChange}
            arrayError={errors[`${PREFIX}.tiers`]}
            getCellError={(index, key) => errors[`${PREFIX}.tiers.${index}.${String(key)}`]}
            newRow={() => ({ withinDays: 7, bonusAmount: 0, label: '', goodieLabel: '', goodieCashEquivalent: 0 })}
          />
        </CardContent>
      )}
    </Card>
  );
}
