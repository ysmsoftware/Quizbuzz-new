'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { useQueryClient } from '@tanstack/react-query';

interface DeleteCampaignModalProps {
  campaignId: string;
  campaignName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteCampaignModal({
  campaignId,
  campaignName,
  open,
  onOpenChange,
  onSuccess,
}: DeleteCampaignModalProps) {
  const queryClient = useQueryClient();
  const { archiveCampaign, archiveCampaignLoading } = useOrgAmbassadorCampaign(campaignId);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await archiveCampaign();
      toast.success(`Campaign "${campaignName}" deleted`);
      await queryClient.invalidateQueries({ queryKey: ['org-ambassador-campaigns'] });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Campaign
          </DialogTitle>
          <DialogDescription className="text-xs pt-1">
            Are you sure you want to delete <span className="font-semibold text-foreground">&quot;{campaignName}&quot;</span>?
            <br />
            This campaign will be archived in the backend.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading || archiveCampaignLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading || archiveCampaignLoading}
          >
            {loading || archiveCampaignLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
