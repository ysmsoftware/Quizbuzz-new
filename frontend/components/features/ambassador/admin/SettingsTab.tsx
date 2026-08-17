'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { listContests } from '@/lib/api/contests.api';
import { useOrgAmbassadorCampaign, useOrgAmbassadorCampaignTemplates } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { isFieldEditable } from '../campaign-field-locks';
import { LockedNotice } from './ReadOnlySummary';
import type { CampaignResult } from '@/lib/types/ambassador';

export function SettingsTab({ campaign }: { campaign: CampaignResult }) {
  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');
  const { updateCampaign, updateCampaignLoading } = useOrgAmbassadorCampaign(campaign.id);
  const { createTemplate, createTemplateLoading } = useOrgAmbassadorCampaignTemplates();
  const [templateName, setTemplateName] = useState(`${campaign.name} Template`);

  const handleSaveAsTemplate = async () => {
    try {
      await createTemplate({ sourceCampaignId: campaign.id, name: templateName.trim() || `${campaign.name} Template` });
      toast.success('Saved as template');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    }
  };

  const { data: contestsRes } = useQuery({
    queryKey: ['contests', 'list', { limit: 100 }],
    queryFn: () => listContests({ limit: 100 }),
    enabled: !!activeOrg?.id,
  });
  const contestTitle = contestsRes?.data?.data?.find((c) => c.id === campaign.contestId)?.title ?? 'Unknown';

  const nameEditable = isFieldEditable('name', campaign.status);
  const typesEditable = isFieldEditable('ambassadorTypesAllowed', campaign.status);

  const [name, setName] = useState(campaign.name);
  const [typesAllowed, setTypesAllowed] = useState(campaign.ambassadorTypesAllowed);

  useEffect(() => {
    setName(campaign.name);
    setTypesAllowed(campaign.ambassadorTypesAllowed);
  }, [campaign.id, campaign.name, campaign.ambassadorTypesAllowed]);

  const dirty = name !== campaign.name || JSON.stringify(typesAllowed) !== JSON.stringify(campaign.ambassadorTypesAllowed);

  const toggleType = (key: string, checked: boolean) => {
    setTypesAllowed((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)));
  };

  const handleSave = async () => {
    try {
      await updateCampaign({
        ...(nameEditable && name !== campaign.name && { name }),
        ...(typesEditable && JSON.stringify(typesAllowed) !== JSON.stringify(campaign.ambassadorTypesAllowed) && { ambassadorTypesAllowed: typesAllowed }),
      });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Campaign Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!nameEditable} />
          </div>

          <div className="space-y-2">
            <Label>Promoting</Label>
            <p className="text-sm text-muted-foreground">{contestTitle}</p>
            <LockedNotice>The promoted quiz can only be set while a campaign is in draft.</LockedNotice>
          </div>

          <div className="space-y-2">
            <Label>Ambassador Types Allowed</Label>
            {typesEditable ? (
              <div className="space-y-2">
                {types.map((t) => (
                  <div key={t.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`settings-type-${t.key}`}
                      checked={typesAllowed.includes(t.key)}
                      onCheckedChange={(checked) => toggleType(t.key, checked === true)}
                    />
                    <Label htmlFor={`settings-type-${t.key}`} className="font-normal cursor-pointer">
                      {t.label}
                    </Label>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {types.filter((t) => campaign.ambassadorTypesAllowed.includes(t.key)).map((t) => t.label).join(', ') || '—'}
                </p>
                <LockedNotice>Ambassador types can only be changed while a campaign is in draft.</LockedNotice>
              </>
            )}
          </div>

          {(nameEditable || typesEditable) && (
            <Button disabled={!dirty || updateCampaignLoading} onClick={handleSave}>
              {updateCampaignLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Save as Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Reuse this campaign&apos;s ambassador types, reward config, share templates, and ambassador structure the next time you
            create a campaign. Timeline dates aren&apos;t included — each campaign sets its own.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" />
            <Button disabled={createTemplateLoading} onClick={handleSaveAsTemplate}>
              {createTemplateLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save as Template
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
