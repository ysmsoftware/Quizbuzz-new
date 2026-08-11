'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RepeatingRowTable, type RepeatingRowColumn } from './RepeatingRowTable';
import type { FieldErrorMap } from './campaign-schema';
import type { MilestoneTier } from '@/lib/types/ambassador';

/**
 * Flat row shape for the table. `goodie` is a nested optional object on MilestoneTier
 * ({ label, cashEquivalent }), but RepeatingRowTable only edits flat scalar columns —
 * so it's split into two flat columns here and reassembled into `goodie` on every
 * change (same flatten/reconstruct pattern LeaderboardPrizesEditor uses for `rank`).
 */
interface MilestoneRow {
  label: string;
  minRegistrations: number;
  maxRegistrations: number | null;
  amountPerRegistration: number;
  goodieLabel: string;
  goodieCashEquivalent: number;
}

const COLUMNS: RepeatingRowColumn<MilestoneRow>[] = [
  { key: 'label', label: 'Tier Name', type: 'text', placeholder: 'Level 1' },
  { key: 'minRegistrations', label: 'Min Registrations', type: 'number' },
  { key: 'maxRegistrations', label: 'Max (blank = uncapped)', type: 'number' },
  { key: 'amountPerRegistration', label: 'Amount / Registration (paise)', type: 'number' },
  { key: 'goodieLabel', label: 'Goodie (optional)', type: 'text', placeholder: 'Gift voucher, Bluetooth earbuds…' },
  { key: 'goodieCashEquivalent', label: 'Goodie Value (paise, optional)', type: 'number' },
];

const PREFIX = 'rewardConfig.milestoneTiers';

export function MilestoneTiersEditor({
  tiers,
  onChange,
  errors = {},
}: {
  tiers: MilestoneTier[];
  onChange: (tiers: MilestoneTier[]) => void;
  errors?: FieldErrorMap;
}) {
  const rows: MilestoneRow[] = tiers.map((t) => ({
    label: t.label ?? '',
    minRegistrations: t.minRegistrations,
    maxRegistrations: t.maxRegistrations,
    amountPerRegistration: t.amountPerRegistration,
    goodieLabel: t.goodie?.label ?? '',
    goodieCashEquivalent: t.goodie?.cashEquivalent ?? 0,
  }));

  const handleChange = (nextRows: MilestoneRow[]) => {
    onChange(
      nextRows.map((r) => ({
        label: r.label || undefined,
        minRegistrations: r.minRegistrations,
        maxRegistrations: r.maxRegistrations,
        rewardType: 'PER_REGISTRATION' as const,
        amountPerRegistration: r.amountPerRegistration,
        goodie: r.goodieLabel
          ? { label: r.goodieLabel, cashEquivalent: r.goodieCashEquivalent || undefined }
          : undefined,
      })),
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Milestone Tiers</CardTitle>
      </CardHeader>
      <CardContent>
        <RepeatingRowTable
          rows={rows}
          columns={COLUMNS}
          onChange={handleChange}
          addLabel="Add tier"
          arrayError={errors[PREFIX]}
          getCellError={(index, key) => errors[`${PREFIX}.${index}.${String(key)}`]}
          newRow={() => ({
            label: '',
            minRegistrations: 0,
            maxRegistrations: null,
            amountPerRegistration: 0,
            goodieLabel: '',
            goodieCashEquivalent: 0,
          })}
        />
      </CardContent>
    </Card>
  );
}
