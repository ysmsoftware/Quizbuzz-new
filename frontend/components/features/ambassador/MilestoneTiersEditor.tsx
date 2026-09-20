'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RepeatingRowTable, type RepeatingRowColumn } from './RepeatingRowTable';
import { useRewardImageUpload } from '@/lib/hooks/useRewardImageUpload';
import type { FieldErrorMap } from './campaign-schema';
import { withDerivedMins } from '@/lib/utils/milestone-tiers';
import type { MilestoneTier } from '@/lib/types/ambassador';

interface MilestoneRow {
  label: string;
  minRegistrations: number;
  maxRegistrations: number | null;
  amountPerRegistration: number;
  goodieLabel: string;
  goodieCashEquivalent: number;
  goodieImageUrl: string;
}

const COLUMNS: RepeatingRowColumn<MilestoneRow>[] = [
  { key: 'label', label: 'Tier Name', type: 'text', placeholder: 'Level 1', minWidth: 'min-w-[130px]' },
  // Only the top of each tier is entered; the bottom is always the previous tier's top + 1 (see withDerivedMins).
  { key: 'maxRegistrations', label: 'Up to (registrations)', type: 'number', placeholder: 'Blank = no limit', blankWhenZero: true, minWidth: 'min-w-[140px]' },
  { key: 'amountPerRegistration', label: 'Amount / Reg (₹)', type: 'number', minWidth: 'min-w-[112px]' },
  { key: 'goodieLabel', label: 'Goodie (optional)', type: 'text', placeholder: 'Gift voucher, earbuds…', minWidth: 'min-w-[160px]' },
  { key: 'goodieCashEquivalent', label: 'Goodie Value (₹)', type: 'number', minWidth: 'min-w-[112px]' },
  { key: 'goodieImageUrl', label: 'Image', type: 'image', minWidth: 'min-w-[64px]' },
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
  const uploadRewardImage = useRewardImageUpload();
  const rows: MilestoneRow[] = tiers.map((t) => ({
    label: t.label ?? '',
    minRegistrations: t.minRegistrations,
    maxRegistrations: t.maxRegistrations,
    amountPerRegistration: t.amountPerRegistration,
    goodieLabel: t.goodie?.label ?? '',
    goodieCashEquivalent: t.goodie?.cashEquivalent ?? 0,
    goodieImageUrl: t.goodie?.imageUrl ?? '',
  }));

  const handleChange = (nextRows: MilestoneRow[]) => {
    onChange(
      withDerivedMins(nextRows.map((r) => ({
        // Keep the raw text here — don't trim on every keystroke. `rows` above is fed
        // straight back from `tiers`, so this is a controlled input: trimming on every
        // change would strip a trailing space the instant it's typed (typing "Level "
        // would immediately snap back to "Level" on the next render), making it
        // impossible to type a multi-word label. `.trim()` is still used to decide
        // whether the field counts as empty; leading/trailing whitespace is trimmed for
        // real at the actual save boundary by the backend's Zod schema (label: z.string().trim()).
        label: r.label.trim() ? r.label : undefined,
        minRegistrations: r.minRegistrations,
        // A cleared number cell arrives as 0 (see RepeatingRowTable) — that means "no limit", not "0".
        maxRegistrations: r.maxRegistrations || null,
        rewardType: 'PER_REGISTRATION' as const,
        amountPerRegistration: r.amountPerRegistration,
        goodie: r.goodieLabel.trim()
          ? { label: r.goodieLabel, cashEquivalent: r.goodieCashEquivalent || undefined, imageUrl: r.goodieImageUrl || undefined }
          : undefined,
      }))),
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Milestone Tiers</CardTitle>
        <p className="text-xs text-muted-foreground">
          Enter each tier&apos;s upper limit, in order — a tier starts right after the previous one ends. A tier&apos;s
          rate applies to the registrations inside it, and its goodie unlocks once the ambassador reaches its limit.
          Leave the last tier&apos;s limit blank for no upper limit.
        </p>
      </CardHeader>
      <CardContent>
        <RepeatingRowTable
          rows={rows}
          columns={COLUMNS}
          onChange={handleChange}
          onUploadImage={uploadRewardImage}
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
            minRegistrations: 0, // derived on change
            maxRegistrations: null,
            amountPerRegistration: 0,
            goodieLabel: '',
            goodieCashEquivalent: 0,
            goodieImageUrl: '',
          })}
        />
      </CardContent>
    </Card>
  );
}
