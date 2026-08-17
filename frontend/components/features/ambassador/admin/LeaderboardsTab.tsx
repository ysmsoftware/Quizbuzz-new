'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { LeaderboardPrizesEditor } from '../LeaderboardPrizesEditor';
import { isFieldEditable } from '../campaign-field-locks';
import { LockedNotice, SummaryRow } from './ReadOnlySummary';
import type { CampaignResult, DraftRewardConfig } from '@/lib/types/ambassador';

export function LeaderboardsTab({ campaign }: { campaign: CampaignResult }) {
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
      toast.success('Leaderboards saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  if (!editable) {
    return (
      <div className="space-y-4">
        <LockedNotice>
          Leaderboard prizes are part of the reward config and lock together with it once a campaign goes live.
        </LockedNotice>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Leaderboard Prizes</CardTitle>
          </CardHeader>
          <CardContent>
            <SummaryRow label="Configured leaderboards" value={String(campaign.rewardConfig.leaderboardPrizes?.length ?? 0)} />
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          For live rankings, see the Report page for this campaign.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LeaderboardPrizesEditor
        cuts={rewardConfig.leaderboardPrizes ?? []}
        ambassadorTypesAllowed={campaign.ambassadorTypesAllowed}
        onChange={(leaderboardPrizes) => setRewardConfig((r) => ({ ...r, leaderboardPrizes }))}
      />
      <Button disabled={!dirty || updateCampaignLoading} onClick={handleSave}>
        {updateCampaignLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}
