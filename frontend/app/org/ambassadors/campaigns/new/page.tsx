'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileStack, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useOrgAmbassadorCampaignTemplates } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { CampaignWizard } from '@/components/features/ambassador/wizard/CampaignWizard';

/**
 * "Start from scratch" vs "Use a template" picker (§5.7) — the very first thing an admin
 * sees before Basics. Picking a template calls the instantiate endpoint to create a
 * pre-filled DRAFT campaign, then hands off to the same wizard used for a blank start.
 */
export default function NewAmbassadorCampaignPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'scratch'>('choose');
  const { templates, isLoading, instantiateTemplate, instantiateTemplateLoading, deleteTemplate, deleteTemplateLoading } =
    useOrgAmbassadorCampaignTemplates({ limit: 50 });
  const [instantiatingId, setInstantiatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (mode === 'scratch') {
    return <CampaignWizard />;
  }

  const handleUseTemplate = async (id: string) => {
    setInstantiatingId(id);
    try {
      const res = await instantiateTemplate({ id });
      router.push(`/org/ambassadors/campaigns/${res.data.id}/wizard`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign from template');
    } finally {
      setInstantiatingId(null);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTemplate(id);
      toast.success('Template deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Ambassador Campaign</h1>
        <p className="text-sm text-muted-foreground">Start from scratch, or reuse a saved template to skip the setup you&apos;ve already done before.</p>
      </div>

      <Card className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setMode('scratch')}>
        <CardContent className="flex items-center gap-4 py-5">
          <div className="rounded-full bg-primary/10 p-2.5">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Start from scratch</p>
            <p className="text-sm text-muted-foreground">Build a new campaign step by step.</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Saved Templates</h2>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <FileStack className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle>No templates yet</EmptyTitle>
            <EmptyDescription>Save any campaign as a template from its Settings tab to reuse it here.</EmptyDescription>
          </Empty>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="border-border/50">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {template.ambassadorTypesAllowed.length} ambassador type{template.ambassadorTypesAllowed.length === 1 ? '' : 's'} ·{' '}
                    {template.rewardConfig.milestoneTiers?.length ?? 0} reward tier{(template.rewardConfig.milestoneTiers?.length ?? 0) === 1 ? '' : 's'} ·{' '}
                    {template.groups.length} group{template.groups.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={deletingId === template.id && deleteTemplateLoading}
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    {deletingId === template.id && deleteTemplateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    disabled={instantiatingId === template.id && instantiateTemplateLoading}
                    onClick={() => handleUseTemplate(template.id)}
                  >
                    {instantiatingId === template.id && instantiateTemplateLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Use Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
