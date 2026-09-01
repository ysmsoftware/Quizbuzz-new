'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrgAmbassadorCampaignTemplates } from '@/lib/hooks/useOrgAmbassadorCampaigns';

interface SaveAsTemplateModalProps {
  campaignId: string;
  campaignName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SaveAsTemplateModal({
  campaignId,
  campaignName,
  open,
  onOpenChange,
  onSuccess,
}: SaveAsTemplateModalProps) {
  const [templateName, setTemplateName] = useState('');
  const { createTemplate, createTemplateLoading } = useOrgAmbassadorCampaignTemplates();

  useEffect(() => {
    if (open) {
      setTemplateName(campaignName ? `${campaignName} Template` : '');
    }
  }, [open, campaignName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    try {
      await createTemplate({
        sourceCampaignId: campaignId,
        name: templateName.trim(),
      });
      toast.success('Campaign saved as template');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <BookmarkPlus className="h-5 w-5 text-primary" />
              Save as Campaign Template
            </DialogTitle>
            <DialogDescription className="text-xs">
              Save this campaign&apos;s allowed types, reward configuration, share templates, and group structure as a template for future campaigns.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name" className="text-xs font-semibold">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Standard Campus Ambassador Drive"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={createTemplateLoading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createTemplateLoading}>
              {createTemplateLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
