'use client';

import { LeaderboardPrizesEditor } from '../../LeaderboardPrizesEditor';
import type { FieldErrorMap } from '../../campaign-schema';
import type { DraftRewardConfig } from '@/lib/types/ambassador';

export function LeaderboardsStep({
  value,
  ambassadorTypesAllowed,
  onChange,
  errors = {},
}: {
  value: DraftRewardConfig;
  ambassadorTypesAllowed: string[];
  onChange: (value: DraftRewardConfig) => void;
  errors?: FieldErrorMap;
}) {
  return (
    <LeaderboardPrizesEditor
      cuts={value.leaderboardPrizes ?? []}
      ambassadorTypesAllowed={ambassadorTypesAllowed}
      onChange={(leaderboardPrizes) => onChange({ ...value, leaderboardPrizes })}
      errors={errors}
    />
  );
}
