'use client';

import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RepeatingRowTable, type RepeatingRowColumn } from './RepeatingRowTable';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import type { FieldErrorMap } from './campaign-schema';
import type { LeaderboardCut } from '@/lib/types/ambassador';

const MAX_GROUP_FIELD_KEYS = 3;

// ponytail: rank rows here only support a single `rank` + cash + label — no
// rankRange or goodie editing yet. Add a "range" toggle per row if a campaign
// actually needs banded prizes (e.g. rank 4-10 share a reward).
const RANK_COLUMNS: RepeatingRowColumn<{ rank: number; cashAmount: number; label: string }>[] = [
  { key: 'rank', label: 'Rank', type: 'number' },
  { key: 'cashAmount', label: 'Cash Amount (₹)', type: 'number' },
  { key: 'label', label: 'Label', type: 'text', placeholder: 'Winner' },
];

const PREFIX = 'rewardConfig.leaderboardPrizes';

function RankEditor({
  cut,
  cutPrefix,
  errors,
  onChange,
}: {
  cut: LeaderboardCut;
  cutPrefix: string;
  errors: FieldErrorMap;
  onChange: (patch: Partial<LeaderboardCut>) => void;
}) {
  const rankRows = cut.ranks.map((r) => ({
    rank: r.rank ?? r.rankRange?.[0] ?? 0,
    cashAmount: r.cashAmount ?? 0,
    label: r.label ?? '',
  }));

  return (
    <RepeatingRowTable
      rows={rankRows}
      columns={RANK_COLUMNS}
      addLabel="Add rank"
      arrayError={errors[`${cutPrefix}.ranks`]}
      getCellError={(index, key) => {
        const k = String(key);
        const baseKey = `${cutPrefix}.ranks.${index}.${k}`;
        if (k === 'goodieLabel') {
          return errors[`${cutPrefix}.ranks.${index}.goodie.label`] || errors[`${cutPrefix}.ranks.${index}.goodie`] || errors[baseKey];
        }
        if (k === 'goodieCashEquivalent') {
          return errors[`${cutPrefix}.ranks.${index}.goodie.cashEquivalent`] || errors[`${cutPrefix}.ranks.${index}.goodie`] || errors[baseKey];
        }
        return errors[baseKey];
      }}
      newRow={() => ({ rank: rankRows.length + 1, cashAmount: 0, label: '' })}
      onChange={(rows) =>
        onChange({
          // Keep the raw label text — don't trim on every keystroke, which would strip a
          // trailing space as soon as it's typed (this is a controlled input fed back from
          // `cut.ranks` above) and make a multi-word label impossible to type. `.trim()`
          // still decides emptiness; real trimming happens server-side at save time.
          ranks: rows.map((r) => ({ rank: r.rank, cashAmount: r.cashAmount, label: r.label.trim() ? r.label : undefined })),
        })
      }
    />
  );
}

export function LeaderboardPrizesEditor({
  cuts,
  ambassadorTypesAllowed,
  onChange,
  errors = {},
}: {
  cuts: LeaderboardCut[];
  ambassadorTypesAllowed: string[];
  onChange: (cuts: LeaderboardCut[]) => void;
  errors?: FieldErrorMap;
}) {
  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');

  const fieldOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of types) {
      if (!ambassadorTypesAllowed.includes(t.key)) continue;
      for (const f of t.applicationFields) {
        if (!seen.has(f.key)) seen.set(f.key, f.label);
      }
    }
    return Array.from(seen, ([key, label]) => ({ key, label }));
  }, [types, ambassadorTypesAllowed]);

  const individualIndex = cuts.findIndex((c) => c.scope.kind === 'INDIVIDUAL_AMBASSADOR');
  const individualCut = individualIndex >= 0 ? cuts[individualIndex] : undefined;

  const updateCutAt = (index: number, patch: Partial<LeaderboardCut>) => {
    onChange(cuts.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeCutAt = (index: number) => onChange(cuts.filter((_, i) => i !== index));

  const toggleIndividual = (enabled: boolean) => {
    if (enabled) {
      onChange([...cuts, { scope: { kind: 'INDIVIDUAL_AMBASSADOR' }, label: 'Individual Ambassador', ranks: [] }]);
    } else if (individualIndex >= 0) {
      removeCutAt(individualIndex);
    }
  };

  const addGroupCut = () => {
    onChange([...cuts, { scope: { kind: 'APPLICATION_FIELD_GROUP', groupByFieldKeys: [] }, label: 'New Leaderboard', ranks: [] }]);
  };

  const toggleGroupFieldKey = (index: number, key: string, checked: boolean, current: string[]) => {
    const groupByFieldKeys = checked ? [...current, key] : current.filter((k) => k !== key);
    updateCutAt(index, { scope: { kind: 'APPLICATION_FIELD_GROUP', groupByFieldKeys } });
  };

  return (
    <div className="space-y-3">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Individual Ambassador</CardTitle>
          <CardAction className="flex items-center gap-2">
            <Switch checked={!!individualCut} onCheckedChange={toggleIndividual} />
            <Label className="text-sm text-muted-foreground">Enabled</Label>
          </CardAction>
        </CardHeader>
        {individualCut && (
          <CardContent className="space-y-4">
            <RankEditor
              cut={individualCut}
              cutPrefix={`${PREFIX}.${individualIndex}`}
              errors={errors}
              onChange={(patch) => updateCutAt(individualIndex, patch)}
            />
          </CardContent>
        )}
      </Card>

      {cuts.map((cut, index) => {
        if (cut.scope.kind !== 'APPLICATION_FIELD_GROUP') return null;
        const cutPrefix = `${PREFIX}.${index}`;
        const groupByFieldKeys = cut.scope.groupByFieldKeys ?? [];

        return (
          <Card key={index} className="border-border/50">
            <CardHeader>
              <Input
                value={cut.label}
                onChange={(e) => updateCutAt(index, { label: e.target.value })}
                className={cn('max-w-xs font-medium', errors[`${cutPrefix}.label`] && 'border-destructive focus-visible:ring-destructive/20')}
                aria-invalid={!!errors[`${cutPrefix}.label`]}
              />
              <CardAction>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeCutAt(index)} aria-label="Remove leaderboard">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {errors[`${cutPrefix}.label`] && <p className="text-xs text-destructive -mt-2">{errors[`${cutPrefix}.label`]}</p>}

              <div className="space-y-2">
                <Label>Group By</Label>
                {fieldOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Select ambassador types in the Promotion step first to choose what to group by.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {fieldOptions.map((f) => {
                      const checked = groupByFieldKeys.includes(f.key);
                      const disabled = !checked && groupByFieldKeys.length >= MAX_GROUP_FIELD_KEYS;
                      return (
                        <div key={f.key} className="flex items-center gap-2">
                          <Checkbox
                            id={`${cutPrefix}-field-${f.key}`}
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(v) => toggleGroupFieldKey(index, f.key, v === true, groupByFieldKeys)}
                          />
                          <Label htmlFor={`${cutPrefix}-field-${f.key}`} className={cn('font-normal cursor-pointer', disabled && 'text-muted-foreground')}>
                            {f.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
                {errors[`${cutPrefix}.scope.groupByFieldKeys`] && (
                  <p className="text-sm text-destructive">{errors[`${cutPrefix}.scope.groupByFieldKeys`]}</p>
                )}
              </div>

              <RankEditor cut={cut} cutPrefix={cutPrefix} errors={errors} onChange={(patch) => updateCutAt(index, patch)} />
            </CardContent>
          </Card>
        );
      })}

      <Button type="button" size="sm" variant="outline" onClick={addGroupCut}>
        <Plus className="h-4 w-4 mr-2" />
        Add a group leaderboard
      </Button>
    </div>
  );
}
