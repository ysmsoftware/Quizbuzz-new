'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RepeatingRowTable, type RepeatingRowColumn } from '../../RepeatingRowTable';
import { calculateCampaignCapacity } from '../../campaign-capacity';
import type { FieldErrorMap } from '../../campaign-schema';
import type { AmbassadorGroupInput } from '@/lib/types/ambassador';

interface GroupRow {
  groupType: string;
  name: string;
  ambassadorTarget: number;
  registrationTarget: number;
}

const COLUMNS: RepeatingRowColumn<GroupRow>[] = [
  {
    key: 'groupType',
    label: 'Group Type',
    type: 'combobox',
    options: ['Department', 'College', 'Team', 'Region', 'Cohort'],
    placeholder: 'Type or pick a category',
  },
  { key: 'name', label: 'Group Name', type: 'text', placeholder: 'Computer Science' },
  { key: 'ambassadorTarget', label: 'Ambassadors', type: 'number', placeholder: '1' },
  { key: 'registrationTarget', label: 'Registrations / Ambassador', type: 'number', placeholder: '100' },
];

/** Optional step — planning aid, not required to publish. Lets an admin sketch the campaign's
 *  structure (e.g. "50 departments, 1 ambassador each, 100 registrations target") and see the
 *  resulting capacity estimate before committing to it. */
export function AmbassadorStructureStep({
  groups,
  onChange,
  errors = {},
}: {
  groups: AmbassadorGroupInput[];
  onChange: (groups: AmbassadorGroupInput[]) => void;
  errors?: FieldErrorMap;
}) {
  const rows: GroupRow[] = groups.map((g) => ({
    groupType: g.groupType,
    name: g.name,
    ambassadorTarget: g.ambassadorTarget ?? 0,
    registrationTarget: g.registrationTarget ?? 0,
  }));

  const handleChange = (nextRows: GroupRow[]) => {
    onChange(
      nextRows.map((r) => ({
        groupType: r.groupType,
        name: r.name,
        ambassadorTarget: r.ambassadorTarget || undefined,
        registrationTarget: r.registrationTarget || undefined,
      })),
    );
  };

  const capacity = calculateCampaignCapacity(groups);

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Ambassador Structure</CardTitle>
          <p className="text-sm text-muted-foreground">
            Break the campaign into groups — departments, colleges, or a custom split — with a target number of
            ambassadors and registrations each. Optional: skip this if you'd rather track capacity informally.
          </p>
        </CardHeader>
        <CardContent>
          <RepeatingRowTable
            rows={rows}
            columns={COLUMNS}
            onChange={handleChange}
            addLabel="Add group"
            arrayError={errors.groups}
            getCellError={(index, key) => errors[`groups.${index}.${String(key)}`]}
            newRow={() => ({ groupType: 'Department', name: '', ambassadorTarget: 1, registrationTarget: 100 })}
          />
        </CardContent>
      </Card>

      {groups.length > 0 && (
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-1 py-4 text-sm">
            <span className="font-medium">Estimated capacity:</span>
            <span>{capacity.totalAmbassadorTarget} ambassadors</span>
            <span className="text-muted-foreground">across {capacity.groupCount} group{capacity.groupCount === 1 ? '' : 's'}</span>
            <span className="font-medium ml-auto">{capacity.totalRegistrationTarget.toLocaleString()} registrations target</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
