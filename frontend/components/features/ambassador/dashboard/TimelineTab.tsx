'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { isFieldEditable } from '../campaign-field-locks';
import { generateCampaignPhases } from '../campaign-timeline';
import { LockedNotice, SummaryRow } from './ReadOnlySummary';
import type { CampaignResult } from '@/lib/types/ambassador';

export function TimelineTab({ campaign }: { campaign: CampaignResult }) {
  const { updateCampaign, updateCampaignLoading } = useOrgAmbassadorCampaign(campaign.id);

  const startEditable = isFieldEditable('startDate', campaign.status);
  const endEditable = isFieldEditable('endDate', campaign.status);
  const editable = startEditable && endEditable;

  const [startDate, setStartDate] = useState(campaign.startDate ?? '');
  const [endDate, setEndDate] = useState(campaign.endDate ?? '');

  useEffect(() => {
    setStartDate(campaign.startDate ?? '');
    setEndDate(campaign.endDate ?? '');
  }, [campaign.id, campaign.startDate, campaign.endDate]);

  const dirty = startDate !== (campaign.startDate ?? '') || endDate !== (campaign.endDate ?? '');

  const start = startDate ? new Date(startDate) : undefined;
  const end = endDate ? new Date(endDate) : undefined;
  const previewPhases = start && end ? generateCampaignPhases(start, end) : [];
  const savedPhases = campaign.phases ?? [];

  const handleSave = async () => {
    try {
      await updateCampaign({
        ...(startDate !== (campaign.startDate ?? '') && { startDate: startDate || undefined }),
        ...(endDate !== (campaign.endDate ?? '') && { endDate: endDate || undefined }),
      });
      toast.success('Timeline saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  if (!editable) {
    return (
      <div className="space-y-4">
        <LockedNotice>Timeline locks alongside reward config once a campaign is live.</LockedNotice>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <SummaryRow
              label="Dates"
              value={campaign.startDate && campaign.endDate ? `${new Date(campaign.startDate).toLocaleDateString()} – ${new Date(campaign.endDate).toLocaleDateString()}` : 'Not set'}
            />
            <SummaryRow label="Phases" value={String(savedPhases.length)} />
          </CardContent>
        </Card>
        {savedPhases.length > 0 && (
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="space-y-2 pt-4">
              {savedPhases.map((phase) => (
                <div key={phase.key} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{phase.label}</span>
                  <span className="text-muted-foreground">
                    {new Date(phase.startsAt).toLocaleDateString()} – {new Date(phase.endsAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Campaign Start</Label>
              <DatePicker value={start} onChange={(date) => setStartDate(date?.toISOString() ?? '')} />
            </div>
            <div className="space-y-2">
              <Label>Campaign End</Label>
              <DatePicker value={end} onChange={(date) => setEndDate(date?.toISOString() ?? '')} />
            </div>
          </div>

          <Button disabled={!dirty || updateCampaignLoading} onClick={handleSave}>
            {updateCampaignLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {previewPhases.length > 0 && (
        <Card className="border-border/50 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Phase Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {previewPhases.map((phase) => (
              <div key={phase.key} className="flex items-center justify-between text-sm">
                <span className="font-medium">{phase.label}</span>
                <span className="text-muted-foreground">
                  {new Date(phase.startsAt).toLocaleDateString()} – {new Date(phase.endsAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
