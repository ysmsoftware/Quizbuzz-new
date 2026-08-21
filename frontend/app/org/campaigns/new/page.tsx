'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileStack, Loader2, Sparkles, Trash2, ArrowRight, Layers, Users, Award, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
      router.push(`/org/campaigns/${res.data.id}/wizard`);
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
    <div className="space-y-8 max-w-6xl mx-auto py-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground hover:text-foreground -ml-2.5 transition-colors"
          onClick={() => router.push('/org/campaigns')}
        >
          <ChevronLeft className="h-4 w-4 mr-1.5" />
          Back to Campaigns
        </Button>
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75 bg-clip-text">
            Create Ambassador Campaign
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Kick off a new incentive drive for your ambassadors. Save time by starting from a structured campaign template or build one from scratch.
          </p>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Option: Start from Scratch */}
        <div className="lg:col-span-5">
          <div className="h-full flex flex-col">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-3.5">
              Fresh Start
            </h2>
            <Card
              className="group relative overflow-hidden border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-300 cursor-pointer flex-1 flex flex-col justify-between"
              onClick={() => setMode('scratch')}
            >
              {/* Subtle top background glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all duration-500 z-0" />
              
              <CardContent className="relative p-6 flex flex-col justify-between h-full min-h-[280px] z-10">
                <div className="space-y-4">
                  <div className="rounded-xl bg-primary/10 p-3 w-fit group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                      Start from scratch
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Configure a custom campaign step-by-step. Perfect for unique drives, custom milestone tiers, and specific group allocations.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm font-semibold text-primary pt-6 group-hover:translate-x-1.5 transition-transform">
                  Configure wizard
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Option: Saved Templates */}
        <div className="lg:col-span-7 space-y-3.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            Saved Templates
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[92px] w-full rounded-xl" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Empty className="border border-dashed border-border/60 rounded-2xl bg-muted/20 min-h-[280px] flex flex-col items-center justify-center p-8">
              <EmptyMedia variant="icon" className="bg-muted p-4 rounded-full mb-3">
                <FileStack className="h-6 w-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-base font-semibold">No active templates found</EmptyTitle>
              <EmptyDescription className="text-xs text-muted-foreground/80 max-w-[280px] mt-1 text-center">
                Save any campaign as a template from its settings screen to reuse its structure here.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <Card 
                  key={template.id} 
                  className="border-border/60 hover:border-border transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <CardContent className="flex items-center justify-between gap-4 p-5">
                    <div className="space-y-2.5">
                      <p className="font-bold text-base text-foreground leading-snug">{template.name}</p>
                      
                      {/* Metadata tags */}
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="flex items-center gap-1 text-[11px] font-medium py-0.5 px-2 bg-muted/60 text-muted-foreground border-none">
                          <Users className="h-3 w-3" />
                          {template.ambassadorTypesAllowed.length} type{template.ambassadorTypesAllowed.length === 1 ? '' : 's'}
                        </Badge>
                        <Badge variant="secondary" className="flex items-center gap-1 text-[11px] font-medium py-0.5 px-2 bg-muted/60 text-muted-foreground border-none">
                          <Award className="h-3 w-3" />
                          {template.rewardConfig.milestoneTiers?.length ?? 0} tier{(template.rewardConfig.milestoneTiers?.length ?? 0) === 1 ? '' : 's'}
                        </Badge>
                        <Badge variant="secondary" className="flex items-center gap-1 text-[11px] font-medium py-0.5 px-2 bg-muted/60 text-muted-foreground border-none">
                          <Layers className="h-3 w-3" />
                          {template.groups.length} group{template.groups.length === 1 ? '' : 's'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 border-border/50 transition-colors"
                        disabled={deletingId === template.id && deleteTemplateLoading}
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        {deletingId === template.id && deleteTemplateLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="shadow-sm hover:shadow"
                        disabled={instantiatingId === template.id && instantiateTemplateLoading}
                        onClick={() => handleUseTemplate(template.id)}
                      >
                        {instantiatingId === template.id && instantiateTemplateLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          'Use Template'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
