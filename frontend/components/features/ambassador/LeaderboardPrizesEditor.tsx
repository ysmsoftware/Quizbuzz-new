'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RepeatingRowTable, type RepeatingRowColumn } from './RepeatingRowTable';
import { cn } from '@/lib/utils';
import type { FieldErrorMap } from './campaign-schema';
import { LEADERBOARD_SCOPES, type LeaderboardCut, type LeaderboardScope } from '@/lib/types/ambassador';

const SCOPE_LABEL: Record<LeaderboardScope, string> = {
  INDIVIDUAL_AMBASSADOR: 'Individual Ambassador',
  DEPARTMENT: 'Department',
  INTER_COLLEGE_DEPARTMENT: 'Inter-college Department',
  COLLEGE: 'College',
};

// ponytail: rank rows here only support a single `rank` + cash + label — no
// rankRange or goodie editing yet. Add a "range" toggle per row if a campaign
// actually needs banded prizes (e.g. rank 4-10 share a reward).
const RANK_COLUMNS: RepeatingRowColumn<{ rank: number; cashAmount: number; label: string }>[] = [
  { key: 'rank', label: 'Rank', type: 'number' },
  { key: 'cashAmount', label: 'Cash Amount (paise)', type: 'number' },
  { key: 'label', label: 'Label', type: 'text', placeholder: 'Winner' },
];

const PREFIX = 'rewardConfig.leaderboardPrizes';

export function LeaderboardPrizesEditor({
  cuts,
  onChange,
  errors = {},
}: {
  cuts: LeaderboardCut[];
  onChange: (cuts: LeaderboardCut[]) => void;
  errors?: FieldErrorMap;
}) {
  const cutFor = (scope: LeaderboardScope) => cuts.find((c) => c.scope === scope);

  const toggleScope = (scope: LeaderboardScope, enabled: boolean) => {
    if (enabled) {
      onChange([...cuts, { scope, label: SCOPE_LABEL[scope], ranks: [] }]);
    } else {
      onChange(cuts.filter((c) => c.scope !== scope));
    }
  };

  const updateCut = (scope: LeaderboardScope, patch: Partial<LeaderboardCut>) => {
    onChange(cuts.map((c) => (c.scope === scope ? { ...c, ...patch } : c)));
  };

  return (
    <div className="space-y-3">
      {LEADERBOARD_SCOPES.map((scope) => {
        const cut = cutFor(scope);
        // cuts is ordered by when each scope was toggled on, not by LEADERBOARD_SCOPES'
        // fixed render order — use the real array index so error paths (which mirror the
        // submitted array, e.g. "rewardConfig.leaderboardPrizes.1.label") line up correctly.
        const cutIndex = cuts.findIndex((c) => c.scope === scope);
        const cutPrefix = `${PREFIX}.${cutIndex}`;
        const rankRows = (cut?.ranks ?? []).map((r) => ({
          rank: r.rank ?? r.rankRange?.[0] ?? 0,
          cashAmount: r.cashAmount ?? 0,
          label: r.label ?? '',
        }));

        return (
          <Card key={scope} className="border-border/50">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{SCOPE_LABEL[scope]}</CardTitle>
              <div className="flex items-center gap-2">
                <Switch checked={!!cut} onCheckedChange={(checked) => toggleScope(scope, checked)} />
                <Label className="text-sm text-muted-foreground">Enabled</Label>
              </div>
            </CardHeader>
            {cut && (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Section Label</Label>
                  <Input
                    value={cut.label}
                    onChange={(e) => updateCut(scope, { label: e.target.value })}
                    aria-invalid={!!errors[`${cutPrefix}.label`]}
                    className={cn(errors[`${cutPrefix}.label`] && 'border-destructive focus-visible:ring-destructive/20')}
                  />
                  {errors[`${cutPrefix}.label`] && <p className="text-xs text-destructive">{errors[`${cutPrefix}.label`]}</p>}
                </div>
                <RepeatingRowTable
                  rows={rankRows}
                  columns={RANK_COLUMNS}
                  addLabel="Add rank"
                  arrayError={errors[`${cutPrefix}.ranks`]}
                  getCellError={(index, key) => errors[`${cutPrefix}.ranks.${index}.${String(key)}`]}
                  newRow={() => ({ rank: rankRows.length + 1, cashAmount: 0, label: '' })}
                  onChange={(rows) =>
                    updateCut(scope, {
                      ranks: rows.map((r) => ({ rank: r.rank, cashAmount: r.cashAmount, label: r.label || undefined })),
                    })
                  }
                />
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
