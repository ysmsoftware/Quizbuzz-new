'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { ShareTemplatesEditor } from '../ShareTemplatesEditor';
import { isFieldEditable } from '../campaign-field-locks';
import { LockedNotice, SummaryRow } from './ReadOnlySummary';
import type { CampaignResult, ShareTemplates } from '@/lib/types/ambassador';

export function KitTab({ campaign }: { campaign: CampaignResult }) {
  const { updateCampaign, updateCampaignLoading } = useOrgAmbassadorCampaign(campaign.id);
  const editable = isFieldEditable('shareTemplates', campaign.status);

  const [shareTemplates, setShareTemplates] = useState<ShareTemplates>(campaign.shareTemplates);
  useEffect(() => {
    setShareTemplates(campaign.shareTemplates);
  }, [campaign.id, campaign.shareTemplates]);

  const dirty = JSON.stringify(shareTemplates) !== JSON.stringify(campaign.shareTemplates);

  const handleSave = async () => {
    try {
      await updateCampaign({ shareTemplates });
      toast.success('Ambassador kit saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  if (!editable) {
    return (
      <div className="space-y-4">
        <LockedNotice>This campaign is {campaign.status.toLowerCase()} — the ambassador kit can no longer be edited.</LockedNotice>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Share Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <SummaryRow label="WhatsApp message" value={campaign.shareTemplates.whatsappText ? 'Set' : '—'} />
            <SummaryRow label="Instagram caption" value={campaign.shareTemplates.instagramText ? 'Set' : '—'} />
            <SummaryRow label="Poster image" value={campaign.shareTemplates.posterImageUrl ? 'Set' : '—'} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ShareTemplatesEditor value={shareTemplates} onChange={setShareTemplates} />
      <Button disabled={!dirty || updateCampaignLoading} onClick={handleSave}>
        {updateCampaignLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}
