'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { listContests } from '@/lib/api/contests.api';
import { ApiRequestError } from '@/lib/api/apiClient';
import { RewardConfigEditor } from './RewardConfigEditor';
import { ShareTemplatesEditor } from './ShareTemplatesEditor';
import { campaignFormSchema, zodIssuesToErrorMap, detailsToErrorMap, type FieldErrorMap } from './campaign-schema';
import type { CampaignResult, RewardConfig, ShareTemplates } from '@/lib/types/ambassador';

const EMPTY_REWARD_CONFIG: RewardConfig = {
  currency: 'INR',
  amountsInPaise: true,
  milestoneTiers: [],
  leaderboardPrizes: [],
};

export interface CampaignFormValue {
  name: string;
  contestId: string;
  ambassadorTypesAllowed: string[];
  rewardConfig: RewardConfig;
  shareTemplates: ShareTemplates;
}

export function CampaignForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = 'Create Campaign',
}: {
  initial?: CampaignResult;
  /** Let errors throw — CampaignForm catches them and maps ApiRequestError.details onto the offending fields. */
  onSubmit: (value: CampaignFormValue) => Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');

  const { data: contestsRes } = useQuery({
    queryKey: ['contests', 'list', { limit: 100 }],
    queryFn: () => listContests({ limit: 100 }),
    enabled: !!activeOrg?.id,
  });
  const contests = contestsRes?.data?.data ?? [];

  const [name, setName] = useState(initial?.name ?? '');
  const [contestId, setContestId] = useState(initial?.contestId ?? '');
  const [typesAllowed, setTypesAllowed] = useState<string[]>(initial?.ambassadorTypesAllowed ?? []);
  const [rewardConfig, setRewardConfig] = useState<RewardConfig>(initial?.rewardConfig ?? EMPTY_REWARD_CONFIG);
  const [shareTemplates, setShareTemplates] = useState<ShareTemplates>(initial?.shareTemplates ?? {});
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setContestId(initial.contestId);
      setTypesAllowed(initial.ambassadorTypesAllowed);
      setRewardConfig(initial.rewardConfig);
      setShareTemplates(initial.shareTemplates);
    }
  }, [initial]);

  const toggleType = (key: string, checked: boolean) => {
    setTypesAllowed((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));
  };

  const handleSubmit = async () => {
    setFormError(null);
    const value: CampaignFormValue = { name: name.trim(), contestId, ambassadorTypesAllowed: typesAllowed, rewardConfig, shareTemplates };

    const result = campaignFormSchema.safeParse(value);
    if (!result.success) {
      setErrors(zodIssuesToErrorMap(result.error.issues));
      toast.error('Fix the highlighted fields before continuing');
      return;
    }
    setErrors({});

    try {
      await onSubmit(value);
    } catch (err) {
      if (err instanceof ApiRequestError && err.details) {
        setErrors(detailsToErrorMap(err.details));
        toast.error('Fix the highlighted fields before continuing');
      } else {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        setFormError(message);
        toast.error(message);
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label>Campaign Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Winter Sprint Referral Drive"
              aria-invalid={!!errors.name}
              className={cn(errors.name && 'border-destructive focus-visible:ring-destructive/20')}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label>Contest *</Label>
            <Select value={contestId} onValueChange={setContestId} disabled={!!initial}>
              <SelectTrigger className={cn('w-full', errors.contestId && 'border-destructive')}>
                <SelectValue placeholder="Select a contest" />
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
          </div>

          <div className="space-y-2">
            <Label>Ambassador Types Allowed *</Label>
            <div className="space-y-2">
              {types.map((t) => (
                <div key={t.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`type-${t.key}`}
                    checked={typesAllowed.includes(t.key)}
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

      <RewardConfigEditor value={rewardConfig} onChange={setRewardConfig} errors={errors} />
      <ShareTemplatesEditor value={shareTemplates} onChange={setShareTemplates} />

      <Button disabled={submitting} onClick={handleSubmit} className="w-full sm:w-auto">
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}
