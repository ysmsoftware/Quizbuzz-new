'use client';

import { MilestoneTiersEditor } from '../../MilestoneTiersEditor';
import { SpeedBonusEditor } from '../../SpeedBonusEditor';
import type { FieldErrorMap } from '../../campaign-schema';
import type { DraftRewardConfig } from '@/lib/types/ambassador';

export function RewardsStep({
  value,
  onChange,
  contestRegistrationStartDate,
  errors = {},
}: {
  value: DraftRewardConfig;
  onChange: (value: DraftRewardConfig) => void;
  /** The promoted contest's registration-open date (ISO), once one's been picked in the
   *  Promotion step — passed straight through to SpeedBonusEditor. */
  contestRegistrationStartDate?: string;
  errors?: FieldErrorMap;
}) {
  return (
    <div className="space-y-4">
      <MilestoneTiersEditor
        tiers={value.milestoneTiers ?? []}
        onChange={(milestoneTiers) => onChange({ ...value, milestoneTiers })}
        errors={errors}
      />
      <SpeedBonusEditor
        value={value.speedBonus}
        onChange={(speedBonus) => onChange({ ...value, speedBonus })}
        contestRegistrationStartDate={contestRegistrationStartDate}
        errors={errors}
      />
    </div>
  );
}
