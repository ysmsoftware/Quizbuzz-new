'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useOrgAmbassadorCampaign } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import type { AmbassadorCampaignStatus } from '@/lib/types/ambassador';

interface ActionDef {
  label: string;
  description: string;
  confirmLabel: string;
  variant?: 'default' | 'destructive';
  run: () => Promise<unknown>;
}

/** One explicit, confirmed transition per current status — never a raw status dropdown.
 *  Mirrors the backend's dedicated /activate, /end, /archive endpoints one-to-one. */
export function CampaignLifecycleActions({ campaignId, status }: { campaignId: string; status: AmbassadorCampaignStatus }) {
  const { activateCampaign, activateCampaignLoading, endCampaign, endCampaignLoading, archiveCampaign, archiveCampaignLoading } =
    useOrgAmbassadorCampaign(campaignId);
  const [openAction, setOpenAction] = useState<string | null>(null);

  const actions: ActionDef[] = [];
  if (status === 'PUBLISHED') {
    actions.push({
      label: 'Activate campaign',
      description: 'Ambassadors will be able to see and join this campaign. Reward configuration locks once active.',
      confirmLabel: 'Activate',
      run: activateCampaign,
    });
  }
  if (status === 'LIVE') {
    actions.push({
      label: 'End campaign',
      description: 'Stops new joins from counting toward this campaign. Reports and leaderboards stay available.',
      confirmLabel: 'End campaign',
      run: endCampaign,
    });
  }
  if (status !== 'ARCHIVED') {
    actions.push({
      label: 'Archive campaign',
      description: 'This is permanent — an archived campaign can no longer be edited or reactivated.',
      confirmLabel: 'Archive',
      variant: 'destructive',
      run: archiveCampaign,
    });
  }

  if (actions.length === 0) return null;

  const isLoading = activateCampaignLoading || endCampaignLoading || archiveCampaignLoading;

  const handleConfirm = async (action: ActionDef) => {
    try {
      await action.run();
      toast.success(`${action.label} succeeded`);
      setOpenAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <AlertDialog key={action.label} open={openAction === action.label} onOpenChange={(open) => setOpenAction(open ? action.label : null)}>
          <AlertDialogTrigger asChild>
            <Button variant={action.variant === 'destructive' ? 'destructive' : 'outline'} size="sm" disabled={isLoading}>
              {isLoading && openAction === action.label && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {action.label}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{action.label}?</AlertDialogTitle>
              <AlertDialogDescription>{action.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleConfirm(action)}>{action.confirmLabel}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ))}
    </div>
  );
}
