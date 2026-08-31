'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RepeatingRowTable, type RepeatingRowColumn } from './RepeatingRowTable';
import type { FieldErrorMap } from './campaign-schema';
import type { MilestoneTier } from '@/lib/types/ambassador';

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
  { key: 'amountPerRegistration', label: 'Amount / Registration (₹)', type: 'number' },
  { key: 'goodieLabel', label: 'Goodie (optional)', type: 'text', placeholder: 'Gift voucher, Bluetooth earbuds…' },
  { key: 'goodieCashEquivalent', label: 'Goodie Value (₹, optional)', type: 'number' },
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
        // Keep the raw text here — don't trim on every keystroke. `rows` above is fed
        // straight back from `tiers`, so this is a controlled input: trimming on every
        // change would strip a trailing space the instant it's typed (typing "Level "
        // would immediately snap back to "Level" on the next render), making it
        // impossible to type a multi-word label. `.trim()` is still used to decide
        // whether the field counts as empty; leading/trailing whitespace is trimmed for
        // real at the actual save boundary by the backend's Zod schema (label: z.string().trim()).
        label: r.label.trim() ? r.label : undefined,
        minRegistrations: r.minRegistrations,
        maxRegistrations: r.maxRegistrations,
        rewardType: 'PER_REGISTRATION' as const,
        amountPerRegistration: r.amountPerRegistration,
        goodie: r.goodieLabel.trim()
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
          getCellError={(index, key) => {
            const k = String(key);
            const baseKey = `${PREFIX}.${index}.${k}`;
            if (k === 'goodieLabel') {
              return errors[`${PREFIX}.${index}.goodie.label`] || errors[`${PREFIX}.${index}.goodie`] || errors[baseKey];
            }
            if (k === 'goodieCashEquivalent') {
              return errors[`${PREFIX}.${index}.goodie.cashEquivalent`] || errors[`${PREFIX}.${index}.goodie`] || errors[baseKey];
            }
            return errors[baseKey];
          }}
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
