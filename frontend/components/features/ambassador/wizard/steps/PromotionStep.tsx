'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { listContests } from '@/lib/api/contests.api';
import type { FieldErrorMap } from '../../campaign-schema';

export function PromotionStep({
  contestId,
  ambassadorTypesAllowed,
  onContestChange,
  onTypesChange,
  contestLocked,
  errors = {},
}: {
  contestId: string;
  ambassadorTypesAllowed: string[];
  onContestChange: (contestId: string) => void;
  onTypesChange: (types: string[]) => void;
  /** Once a campaign leaves DRAFT, the promoted quiz can't be changed (see backend field-lock guard). */
  contestLocked?: boolean;
  errors?: FieldErrorMap;
}) {
  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');

  const { data: contestsRes } = useQuery({
    queryKey: ['contests', 'list', { limit: 100 }],
    queryFn: () => listContests({ limit: 100 }),
    enabled: !!activeOrg?.id,
  });
  const contests = contestsRes?.data?.data ?? [];

  const toggleType = (key: string, checked: boolean) => {
    onTypesChange(checked ? [...ambassadorTypesAllowed, key] : ambassadorTypesAllowed.filter((k) => k !== key));
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">What are you promoting?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Quiz / Contest *</Label>
          <Select value={contestId} onValueChange={onContestChange} disabled={contestLocked}>
            <SelectTrigger className={cn('w-full', errors.contestId && 'border-destructive')}>
              <SelectValue placeholder="Select a quiz to promote" />
            </SelectTrigger>
            <SelectContent>
              {contests.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.contestId && <p className="text-sm text-destructive">{errors.contestId}</p>}
          {contestLocked && <p className="text-xs text-muted-foreground">The promoted quiz can't be changed after publishing.</p>}
        </div>

        <div className="space-y-2">
          <Label>Ambassador Types Allowed *</Label>
          <div className="space-y-2">
            {types.map((t) => (
              <div key={t.key} className="flex items-center gap-2">
                <Checkbox
                  id={`type-${t.key}`}
                  checked={ambassadorTypesAllowed.includes(t.key)}
                  onCheckedChange={(checked) => toggleType(t.key, checked === true)}
                />
                <Label htmlFor={`type-${t.key}`} className="font-normal cursor-pointer">
                  {t.label}
                </Label>
              </div>
            ))}
          </div>
          {errors.ambassadorTypesAllowed && <p className="text-sm text-destructive">{errors.ambassadorTypesAllowed}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
