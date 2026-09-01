'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileStack, Loader2, Search, Trash2, Users, Award, Layers, Sparkles, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useOrgAmbassadorCampaignTemplates } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { ViewTemplateModal } from './ViewTemplateModal';
import type { CampaignTemplate } from '@/lib/types/ambassador';

export function TemplatesList() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const { templates, isLoading, instantiateTemplate, instantiateTemplateLoading, deleteTemplate, deleteTemplateLoading } =
    useOrgAmbassadorCampaignTemplates({ limit: 100 });
  const [instantiatingId, setInstantiatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<CampaignTemplate | null>(null);

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(q.toLowerCase())
  );

  const handleUseTemplate = async (id: string) => {
    setInstantiatingId(id);
    try {
      const res = await instantiateTemplate({ id });
      toast.success('Draft campaign created from template');
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Empty className="border border-dashed border-border/60 rounded-2xl bg-muted/20 p-8">
          <EmptyMedia variant="icon" className="bg-muted p-4 rounded-full mb-3">
            <FileStack className="h-6 w-6 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="text-base font-semibold">
            {q ? 'No matching templates found' : 'No active campaign templates'}
          </EmptyTitle>
          <EmptyDescription className="text-xs text-muted-foreground max-w-sm mt-1 text-center">
            {q
              ? 'Try adjusting your search query.'
              : 'Save any existing campaign as a template from its settings screen or card menu to reuse its structure here.'}
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="border-border/60 hover:border-border transition-all duration-200 shadow-xs flex flex-col justify-between"
            >
              <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base text-foreground leading-snug truncate" title={template.name}>
                      {template.name}
                    </h3>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Template
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
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

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/40">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => setViewingTemplate(template)}
                      title="View Template Details"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                      disabled={deletingId === template.id && deleteTemplateLoading}
                      onClick={() => handleDeleteTemplate(template.id)}
                      title="Delete Template"
                    >
                      {deletingId === template.id && deleteTemplateLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    className="h-8 shadow-xs"
                    disabled={instantiatingId === template.id && instantiateTemplateLoading}
                    onClick={() => handleUseTemplate(template.id)}
                  >
                    {instantiatingId === template.id && instantiateTemplateLoading ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary-foreground" />
                        Use Template
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ViewTemplateModal
        template={viewingTemplate}
        open={!!viewingTemplate}
        onOpenChange={(open) => {
          if (!open) setViewingTemplate(null);
        }}
      />
    </div>
  );
}
