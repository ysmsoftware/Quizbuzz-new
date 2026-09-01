'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, Loader2, Sparkles, Users, Award, Layers, MessageSquare, Trophy, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { useOrgAmbassadorCampaignTemplates } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import type { CampaignTemplate } from '@/lib/types/ambassador';
import { Rupees } from './Rupees';

interface ViewTemplateModalProps {
  template: CampaignTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewTemplateModal({ template, open, onOpenChange }: ViewTemplateModalProps) {
  const router = useRouter();
  const { activeOrg } = useAuth();
  const { types } = useAmbassadorTypes(activeOrg?.id ?? '');
  const typeLabel = (key: string) => types.find((t) => t.key === key)?.label ?? key;
  const { instantiateTemplate, instantiateTemplateLoading } = useOrgAmbassadorCampaignTemplates();
  const [instantiating, setInstantiating] = useState(false);

  if (!template) return null;

  const rewardConfig = template.rewardConfig;
  const milestoneTiers = rewardConfig.milestoneTiers ?? [];
  const speedBonus = rewardConfig.speedBonus;
  const leaderboardPrizes = rewardConfig.leaderboardPrizes ?? [];
  const groups = template.groups ?? [];
  const shareTemplates = template.shareTemplates;
  const whatsappTemplates = shareTemplates?.whatsappTemplates ?? (shareTemplates?.whatsappText ? [{ id: 'legacy', label: 'Default', text: shareTemplates.whatsappText }] : []);

  const handleUseTemplate = async () => {
    setInstantiating(true);
    try {
      const res = await instantiateTemplate({ id: template.id });
      toast.success('Draft campaign created from template');
      onOpenChange(false);
      router.push(`/org/campaigns/${res.data.id}/wizard`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to instantiate template');
    } finally {
      setInstantiating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/40">
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Eye className="h-5 w-5 text-primary" />
                {template.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Template overview &amp; predefined configurations
              </DialogDescription>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">
              Template
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Summary Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/40 border border-border/50 rounded-xl p-3 text-center space-y-1">
              <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Users className="h-3.5 w-3.5" /> Allowed Types
              </span>
              <p className="font-bold text-sm text-foreground">
                {template.ambassadorTypesAllowed.length > 0
                  ? template.ambassadorTypesAllowed.map(typeLabel).join(', ')
                  : 'All Types'}
              </p>
            </div>
            <div className="bg-muted/40 border border-border/50 rounded-xl p-3 text-center space-y-1">
              <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Award className="h-3.5 w-3.5" /> Reward Tiers
              </span>
              <p className="font-bold text-sm text-foreground">
                {milestoneTiers.length} tier{milestoneTiers.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="bg-muted/40 border border-border/50 rounded-xl p-3 text-center space-y-1">
              <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Layers className="h-3.5 w-3.5" /> Structure
              </span>
              <p className="font-bold text-sm text-foreground">
                {groups.length} group{groups.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <Tabs defaultValue="structure" className="space-y-4">
            <TabsList className="w-full grid grid-cols-3 h-9">
              <TabsTrigger value="structure" className="text-xs">Structure ({groups.length})</TabsTrigger>
              <TabsTrigger value="rewards" className="text-xs">Rewards &amp; Bonuses</TabsTrigger>
              <TabsTrigger value="kit" className="text-xs">Share Kit</TabsTrigger>
            </TabsList>

            <TabsContent value="structure" className="space-y-3 mt-0">
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4">No groups defined in this template.</p>
              ) : (
                <div className="space-y-2">
                  {groups.map((group, idx) => (
                    <Card key={idx} className="border-border/40 bg-muted/20">
                      <CardContent className="p-3.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-foreground">{group.name}</p>
                          <Badge variant="outline" className="text-[10px] mt-1 font-normal">{group.groupType}</Badge>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="text-muted-foreground">Target Ambassadors: <span className="font-semibold text-foreground">{group.ambassadorTarget ?? '—'}</span></p>
                          <p className="text-muted-foreground">Regs / Ambassador: <span className="font-semibold text-foreground">{group.registrationTarget ?? '—'}</span></p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rewards" className="space-y-4 mt-0">
              {/* Milestone Tiers */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-primary" /> Milestone Tiers ({milestoneTiers.length})
                </h4>
                {milestoneTiers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No milestone tiers set.</p>
                ) : (
                  <div className="space-y-2">
                    {milestoneTiers.map((tier, idx) => (
                      <Card key={idx} className="border-border/40 bg-muted/20">
                        <CardContent className="p-3 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-foreground">{tier.label || `Tier ${idx + 1}`}</p>
                            <p className="text-muted-foreground text-[11px]">
                              {tier.minRegistrations} – {tier.maxRegistrations ? `${tier.maxRegistrations} regs` : '∞ regs'}
                            </p>
                          </div>
                          <div className="font-bold text-foreground">
                            {tier.amountPerRegistration ? <Rupees amount={tier.amountPerRegistration} /> : tier.goodie?.label || '—'}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Speed Bonus */}
              {speedBonus?.enabled && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-500" /> Speed Bonus
                  </h4>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs space-y-1">
                    <p className="font-medium text-amber-900 dark:text-amber-200">
                      Enabled — {speedBonus.tiers?.length ?? 0} speed bonus tier(s)
                    </p>
                  </div>
                </div>
              )}

              {/* Leaderboards */}
              {leaderboardPrizes.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-emerald-500" /> Leaderboard Cuts ({leaderboardPrizes.length})
                  </h4>
                  <div className="space-y-1.5">
                    {leaderboardPrizes.map((cut, idx) => (
                      <div key={idx} className="text-xs p-2.5 rounded-lg bg-muted/30 border border-border/40 flex justify-between items-center">
                        <span className="font-medium">{cut.scope?.kind === 'INDIVIDUAL_AMBASSADOR' ? 'Individual Ambassadors' : 'Grouped'} Leaderboard</span>
                        <span className="text-muted-foreground">{cut.ranks?.length ?? 0} ranks rewarded</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="kit" className="space-y-3 mt-0">
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" /> WhatsApp Share Templates ({whatsappTemplates.length})
                </h4>
                {whatsappTemplates.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No share templates preconfigured.</p>
                ) : (
                  whatsappTemplates.map((t, idx) => (
                    <div key={idx} className="bg-muted/30 border border-border/40 rounded-xl p-3.5 space-y-1.5">
                      <p className="text-xs font-semibold text-foreground">{t.label || 'Default Template'}</p>
                      <p className="text-xs text-muted-foreground bg-background/80 p-2.5 rounded-lg font-mono whitespace-pre-wrap">
                        {t.text || '—'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t border-border/40 flex flex-row items-center justify-between sm:justify-between">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" onClick={handleUseTemplate} disabled={instantiating || instantiateTemplateLoading}>
            {instantiating || instantiateTemplateLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary-foreground" />
            )}
            Use This Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
