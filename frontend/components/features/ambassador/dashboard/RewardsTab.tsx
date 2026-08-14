'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { MilestoneTiersEditor } from '../MilestoneTiersEditor';
import { SpeedBonusEditor } from '../SpeedBonusEditor';
import { isFieldEditable } from '../campaign-field-locks';
import { LockedNotice, SummaryRow } from './ReadOnlySummary';
import type { CampaignResult, DraftRewardConfig } from '@/lib/types/ambassador';

export function RewardsTab({ campaign }: { campaign: CampaignResult }) {
  const { updateCampaign, updateCampaignLoading } = useOrgAmbassadorCampaign(campaign.id);
  const editable = isFieldEditable('rewardConfig', campaign.status);

  const [rewardConfig, setRewardConfig] = useState<DraftRewardConfig>(campaign.rewardConfig);
  useEffect(() => {
    setRewardConfig(campaign.rewardConfig);
  }, [campaign.id, campaign.rewardConfig]);

  const dirty = JSON.stringify(rewardConfig) !== JSON.stringify(campaign.rewardConfig);

  const handleSave = async () => {
    try {
      await updateCampaign({ rewardConfig });
      toast.success('Rewards saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  if (!editable) {
    return (
      <div className="space-y-4">
        <LockedNotice>
          Reward economics lock once a campaign goes live, so nobody&apos;s payout changes mid-campaign. This campaign is {campaign.status.toLowerCase()}.
        </LockedNotice>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Milestone Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <SummaryRow label="Tiers" value={String(campaign.rewardConfig.milestoneTiers?.length ?? 0)} />
            <SummaryRow label="Speed bonus" value={campaign.rewardConfig.speedBonus?.enabled ? 'Enabled' : 'Not set'} />
            <SummaryRow label="Currency" value={campaign.rewardConfig.currency ?? '—'} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MilestoneTiersEditor tiers={rewardConfig.milestoneTiers ?? []} onChange={(milestoneTiers) => setRewardConfig((r) => ({ ...r, milestoneTiers }))} />
      <SpeedBonusEditor value={rewardConfig.speedBonus} onChange={(speedBonus) => setRewardConfig((r) => ({ ...r, speedBonus }))} />
      <Button disabled={!dirty || updateCampaignLoading} onClick={handleSave}>
        {updateCampaignLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}
