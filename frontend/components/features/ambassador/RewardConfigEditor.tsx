'use client';

import { MilestoneTiersEditor } from './MilestoneTiersEditor';
import { SpeedBonusEditor } from './SpeedBonusEditor';
import { LeaderboardPrizesEditor } from './LeaderboardPrizesEditor';
import type { FieldErrorMap } from './campaign-schema';
import type { RewardConfig } from '@/lib/types/ambassador';

export function RewardConfigEditor({
  value,
  onChange,
  errors = {},
}: {
  value: RewardConfig;
  onChange: (value: RewardConfig) => void;
  errors?: FieldErrorMap;
}) {
  return (
    <div className="space-y-4">
      <MilestoneTiersEditor
        tiers={value.milestoneTiers}
        onChange={(milestoneTiers) => onChange({ ...value, milestoneTiers })}
        errors={errors}
      />
      <SpeedBonusEditor
        value={value.speedBonus}
        onChange={(speedBonus) => onChange({ ...value, speedBonus })}
        errors={errors}
      />
      <LeaderboardPrizesEditor
        cuts={value.leaderboardPrizes}
        onChange={(leaderboardPrizes) => onChange({ ...value, leaderboardPrizes })}
        errors={errors}
      />
    </div>
  );
}
