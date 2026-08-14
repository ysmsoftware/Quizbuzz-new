'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrgAmbassadorCampaignGroups } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { ApiRequestError } from '@/lib/api/apiClient';
import { RepeatingRowTable, type RepeatingRowColumn } from '../RepeatingRowTable';
import { calculateCampaignCapacity } from '../campaign-capacity';
import { isFieldEditable } from '../campaign-field-locks';
import { detailsToErrorMap, type FieldErrorMap } from '../campaign-schema';
import { LockedNotice, SummaryRow } from './ReadOnlySummary';
import type { AmbassadorGroupInput, CampaignResult } from '@/lib/types/ambassador';

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

export function StructureTab({ campaign }: { campaign: CampaignResult }) {
  const { groups: fetchedGroups, isLoading, replaceGroups, replaceGroupsLoading } = useOrgAmbassadorCampaignGroups(campaign.id);
  const editable = isFieldEditable('groups', campaign.status);

  const [groups, setGroups] = useState<AmbassadorGroupInput[]>([]);
  const [errors, setErrors] = useState<FieldErrorMap>({});
  useEffect(() => {
    setGroups(fetchedGroups.map((g) => ({ groupType: g.groupType, name: g.name, ambassadorTarget: g.ambassadorTarget, registrationTarget: g.registrationTarget })));
  }, [campaign.id, fetchedGroups]);

  const dirty = JSON.stringify(groups) !== JSON.stringify(fetchedGroups.map((g) => ({ groupType: g.groupType, name: g.name, ambassadorTarget: g.ambassadorTarget, registrationTarget: g.registrationTarget })));
  const capacity = calculateCampaignCapacity(groups);

  const handleSave = async () => {
    setErrors({});
    try {
      await replaceGroups(groups);
      toast.success('Ambassador structure saved');
    } catch (err) {
      if (err instanceof ApiRequestError && err.details) {
        setErrors(detailsToErrorMap(err.details));
        toast.error(Object.values(err.details)[0]?.[0] ?? 'Fix the highlighted fields');
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to save');
      }
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!editable) {
    return (
      <div className="space-y-4">
        <LockedNotice>Ambassador structure locks alongside reward config once a campaign is live.</LockedNotice>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Ambassador Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <SummaryRow label="Groups" value={String(capacity.groupCount)} />
            <SummaryRow label="Ambassador target" value={String(capacity.totalAmbassadorTarget)} />
            <SummaryRow label="Registration target" value={capacity.totalRegistrationTarget.toLocaleString()} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows: GroupRow[] = groups.map((g) => ({
    groupType: g.groupType,
    name: g.name,
    ambassadorTarget: g.ambassadorTarget ?? 0,
    registrationTarget: g.registrationTarget ?? 0,
  }));

  const handleChange = (nextRows: GroupRow[]) => {
    setGroups(
      nextRows.map((r) => ({
        groupType: r.groupType,
        name: r.name,
        ambassadorTarget: r.ambassadorTarget || undefined,
        registrationTarget: r.registrationTarget || undefined,
      })),
    );
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Ambassador Structure</CardTitle>
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
            <span className="font-medium ml-auto">{capacity.totalRegistrationTarget.toLocaleString()} registrations target</span>
          </CardContent>
        </Card>
      )}

      <Button disabled={!dirty || replaceGroupsLoading} onClick={handleSave}>
        {replaceGroupsLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}
