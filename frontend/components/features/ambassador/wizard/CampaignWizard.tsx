'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/hooks/useAuth';
import { listContests } from '@/lib/api/contests.api';
import { ApiRequestError } from '@/lib/api/apiClient';
import { useOrgAmbassadorCampaign, useOrgAmbassadorCampaignGroups, useOrgAmbassadorCampaigns } from '@/lib/hooks/useOrgAmbassadorCampaigns';
import { useContest } from '@/lib/hooks/useContest';
import { detailsToErrorMap, type FieldErrorMap } from '../campaign-schema';
import { ShareTemplatesEditor } from '../ShareTemplatesEditor';
import { StepperNav } from './StepperNav';
import { CampaignSummarySidebar } from './CampaignSummarySidebar';
import { BasicsStep } from './steps/BasicsStep';
import { PromotionStep } from './steps/PromotionStep';
import { AmbassadorStructureStep } from './steps/AmbassadorStructureStep';
import { RewardsStep } from './steps/RewardsStep';
import { LeaderboardsStep } from './steps/LeaderboardsStep';
import {
  TimelineStep,
  inferInitialStartMode,
  inferInitialEndMode,
  type CampaignStartMode,
  type CampaignEndMode,
} from './steps/TimelineStep';
import { ReviewPublishStep } from './steps/ReviewPublishStep';
import { EMPTY_DRAFT, WIZARD_STEPS, type StepKey, type WizardDraft } from './wizard-types';
import { addWeeksIso } from '../campaign-timeline';
import type { AmbassadorGroupInput } from '@/lib/types/ambassador';

/**
 * Creation wizard — Basics -> Promotion -> Ambassador Structure -> Rewards -> Leaderboards ->
 * Ambassador Kit -> Review & Publish. Each navigation action (Continue/Back/stepper click)
 * saves the whole accumulated draft via a single PATCH (or the initial POST, for the very
 * first save) before moving — so leaving mid-flow never loses work, and refreshing resumes
 * exactly where you left off (see docs/ambassador-campaign-wizard-plan.md §5).
 */
export function CampaignWizard({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const { activeOrg } = useAuth();

  const [id, setId] = useState<string | undefined>(campaignId);
  const [draft, setDraft] = useState<WizardDraft>(EMPTY_DRAFT);
  const [groups, setGroups] = useState<AmbassadorGroupInput[]>([]);
  const [groupsHydrated, setGroupsHydrated] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestIndex, setFurthestIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [publishErrors, setPublishErrors] = useState<FieldErrorMap | null>(null);
  const [stepErrors, setStepErrors] = useState<FieldErrorMap>({});
  const [hydrated, setHydrated] = useState(!campaignId);
  // Timeline's start/end date "mode" (contest-anchored vs. custom) — owned here, not inside
  // TimelineStep, for the same reason Speed Bonus's sync effect moved here: TimelineStep
  // unmounts whenever the admin leaves the Timeline step, so a sync effect living there would
  // miss a contest reselected from elsewhere. Defaults match a brand-new, empty draft.
  const [startMode, setStartMode] = useState<CampaignStartMode>('CONTEST_PUBLISHED');
  const [endMode, setEndMode] = useState<CampaignEndMode>('CONTEST_END');

  const { createCampaign } = useOrgAmbassadorCampaigns();
  const { campaign, isLoading, updateCampaign, publishCampaign, publishCampaignLoading } = useOrgAmbassadorCampaign(id ?? '');
  const { groups: fetchedGroups, isLoading: groupsLoading, replaceGroups } = useOrgAmbassadorCampaignGroups(id ?? '');

  const { data: contestsRes } = useQuery({
    queryKey: ['contests', 'list', { limit: 100 }],
    queryFn: () => listContests({ limit: 100 }),
    enabled: !!activeOrg?.id,
  });
  const contests = contestsRes?.data?.data ?? [];
  const selectedContest = contests.find((c) => c.id === draft.contestId);
  const contestTitle = selectedContest?.title ?? null;
  const { contest: selectedContestDetail } = useContest(draft.contestId || '');

  // Seed local draft state from the fetched campaign once, when resuming an existing draft.
  useEffect(() => {
    if (campaignId && campaign && !hydrated) {
      setDraft({
        name: campaign.name,
        contestId: campaign.contestId ?? '',
        ambassadorTypesAllowed: campaign.ambassadorTypesAllowed,
        rewardConfig: campaign.rewardConfig,
        shareTemplates: campaign.shareTemplates,
        startDate: campaign.startDate ?? '',
        endDate: campaign.endDate ?? '',
        phaseTemplate: campaign.phaseTemplate,
      });


      const resumedContest = contests.find((c) => c.id === campaign.contestId);
      setStartMode(inferInitialStartMode(campaign.startDate ?? '', resumedContest?.publishedAt || resumedContest?.registrationStartDate || undefined));
      setEndMode(inferInitialEndMode(campaign.endDate ?? '', resumedContest?.contestEndTime || undefined, resumedContest?.contestStartTime || undefined));
      const resumeIndex = Math.min(Math.max(campaign.wizardStep - 1, 0), WIZARD_STEPS.length - 1);
      setStepIndex(resumeIndex);
      setFurthestIndex(resumeIndex);
      setHydrated(true);
    }
  }, [campaignId, campaign, hydrated]);


  useEffect(() => {
    if (campaign && campaign.status !== 'DRAFT' && campaign.status !== 'PUBLISHED') {
      toast.error('This campaign is already live and can no longer be edited in the wizard.');
      router.replace('/org/ambassadors');
    }
  }, [campaign, router]);


  useEffect(() => {
    if (id && !groupsLoading && !groupsHydrated) {
      setGroups(fetchedGroups.map((g) => ({ groupType: g.groupType, name: g.name, ambassadorTarget: g.ambassadorTarget, registrationTarget: g.registrationTarget })));
      setGroupsHydrated(true);
    }
  }, [id, groupsLoading, groupsHydrated, fetchedGroups]);


  useEffect(() => {
    const speedBonus = draft.rewardConfig.speedBonus;
    if (!speedBonus?.enabled) return;
    const mode = speedBonus.campaignStartAtMode ?? 'CONTEST_START';
    if (mode === 'CUSTOM') return;
    const anchor = selectedContestDetail?.registrationStartDate;
    if (!anchor) return;
    const resolved = mode === 'OFFSET_WEEKS' ? addWeeksIso(anchor, speedBonus.campaignStartAtOffsetWeeks ?? 0) : anchor;
    if (resolved !== speedBonus.campaignStartAt) {
      setDraft((d) => ({ ...d, rewardConfig: { ...d.rewardConfig, speedBonus: { ...speedBonus, campaignStartAt: resolved } } }));
    }
  }, [draft.rewardConfig.speedBonus, selectedContestDetail?.registrationStartDate]);


  useEffect(() => {
    if (startMode === 'CUSTOM') return;
    const anchor = selectedContestDetail?.publishedAt || selectedContestDetail?.registrationStartDate || undefined;
    if (anchor && anchor !== draft.startDate) {
      setDraft((d) => ({ ...d, startDate: anchor }));
    }
  }, [startMode, selectedContestDetail?.publishedAt, selectedContestDetail?.registrationStartDate, draft.startDate]);

  useEffect(() => {
    if (endMode === 'CUSTOM') return;
    const anchor = endMode === 'CONTEST_START' ? selectedContestDetail?.contestStartTime : selectedContestDetail?.contestEndTime;
    if (anchor && anchor !== draft.endDate) {
      setDraft((d) => ({ ...d, endDate: anchor }));
    }
  }, [endMode, selectedContestDetail?.contestStartTime, selectedContestDetail?.contestEndTime, draft.endDate]);

  const currentStep = WIZARD_STEPS[stepIndex]!;

  const persistAndGo = async (targetIndex: number) => {
    if (stepIndex === 0 && !draft.name.trim()) {
      toast.error('Give the campaign a name before continuing');
      return;
    }

    setSaving(true);
    setStepErrors({});
    try {
      if (!id) {
        const res = await createCampaign({
          name: draft.name.trim(),
          contestId: draft.contestId || undefined,
          ambassadorTypesAllowed: draft.ambassadorTypesAllowed.length ? draft.ambassadorTypesAllowed : undefined,
          rewardConfig: draft.rewardConfig,
          shareTemplates: draft.shareTemplates,
          wizardStep: targetIndex + 1,
          startDate: draft.startDate || undefined,
          endDate: draft.endDate || undefined,
          phaseTemplate: draft.phaseTemplate,
        });
        const newId = res.data.id;
        setId(newId);
        router.replace(`/org/campaigns/${newId}/wizard`);
      } else {
        await updateCampaign({
          name: draft.name.trim(),
          contestId: draft.contestId || undefined,
          ambassadorTypesAllowed: draft.ambassadorTypesAllowed,
          rewardConfig: draft.rewardConfig,
          shareTemplates: draft.shareTemplates,
          wizardStep: Math.max(targetIndex + 1, campaign?.wizardStep ?? 1),
          startDate: draft.startDate || undefined,
          endDate: draft.endDate || undefined,
          phaseTemplate: draft.phaseTemplate,
        });

        await replaceGroups(groups);
      }
      setStepIndex(targetIndex);
      setFurthestIndex((prev) => Math.max(prev, targetIndex));
    } catch (err) {
      if (err instanceof ApiRequestError && err.details) {
        setStepErrors(detailsToErrorMap(err.details));
        toast.error(Object.values(err.details)[0]?.[0] ?? 'Fix the highlighted fields');
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const goToStep = (key: StepKey) => {
    const targetIndex = WIZARD_STEPS.findIndex((s) => s.key === key);
    if (targetIndex <= furthestIndex || targetIndex === stepIndex + 1) {
      void persistAndGo(targetIndex);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    setPublishErrors(null);
    try {
      await publishCampaign();
      toast.success('Campaign published');
      router.push('/org/campaigns');
    } catch (err) {
      if (err instanceof ApiRequestError && err.details) {
        setPublishErrors(detailsToErrorMap(err.details));
        toast.error('Fix the highlighted fields before publishing');
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to publish');
      }
    }
  };

  const stepBody = useMemo(() => {
    switch (currentStep.key) {
      case 'basics':
        return <BasicsStep name={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} errors={stepErrors} />;
      case 'promotion':
        return (
          <PromotionStep
            contestId={draft.contestId}
            ambassadorTypesAllowed={draft.ambassadorTypesAllowed}
            onContestChange={(contestId) => setDraft((d) => ({ ...d, contestId }))}
            onTypesChange={(ambassadorTypesAllowed) => setDraft((d) => ({ ...d, ambassadorTypesAllowed }))}
            contestLocked={campaign ? campaign.status !== 'DRAFT' : false}
            errors={stepErrors}
          />
        );
      case 'structure':
        return <AmbassadorStructureStep groups={groups} onChange={setGroups} errors={stepErrors} />;
      case 'rewards':
        return (
          <RewardsStep
            value={draft.rewardConfig}
            onChange={(rewardConfig) => setDraft((d) => ({ ...d, rewardConfig }))}
            contestRegistrationStartDate={selectedContestDetail?.registrationStartDate}
            errors={stepErrors}
          />
        );
      case 'leaderboards':
        return (
          <LeaderboardsStep
            value={draft.rewardConfig}
            ambassadorTypesAllowed={draft.ambassadorTypesAllowed}
            onChange={(rewardConfig) => setDraft((d) => ({ ...d, rewardConfig }))}
            errors={stepErrors}
          />
        );
      case 'timeline':
        return (
          <TimelineStep
            startDate={draft.startDate}
            endDate={draft.endDate}
            phaseTemplate={draft.phaseTemplate}
            contest={selectedContestDetail}
            startMode={startMode}
            endMode={endMode}
            onStartModeChange={setStartMode}
            onEndModeChange={setEndMode}
            onChange={({ startDate, endDate }) => setDraft((d) => ({ ...d, startDate, endDate }))}
            onPhaseTemplateChange={(phaseTemplate) => setDraft((d) => ({ ...d, phaseTemplate }))}
            errors={stepErrors}
          />
        );
      case 'kit':
        return (
          <ShareTemplatesEditor
            value={draft.shareTemplates}
            onChange={(shareTemplates) => setDraft((d) => ({ ...d, shareTemplates }))}
            contestTitle={contestTitle ?? undefined}
          />
        );
      case 'review':
        return (
          <ReviewPublishStep
            campaignId={id}
            draft={draft}
            groups={groups}
            contestTitle={contestTitle}
            publishing={publishCampaignLoading}
            publishErrors={publishErrors}
            onGoToStep={goToStep}
            onPublish={handlePublish}
          />
        );
    }

  }, [currentStep.key, draft, groups, contestTitle, selectedContestDetail, startMode, endMode, publishCampaignLoading, publishErrors, stepErrors, campaign, id]);

  const isWizardLocked = !!campaign && campaign.status !== 'DRAFT' && campaign.status !== 'PUBLISHED';
  if (campaignId && (isLoading || !hydrated || isWizardLocked)) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  const isReview = currentStep.key === 'review';

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground hover:text-foreground -ml-2.5 transition-colors"
        onClick={() => router.push('/org/campaigns')}
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back to Campaigns
      </Button>

      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-foreground via-foreground/90 to-foreground/85 bg-clip-text">
          {campaign ? campaign.name || 'Edit Campaign' : 'New Ambassador Campaign'}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
          Build and customize your campaign. Setup progress is auto-saved as you transition between steps.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-8 items-start pt-2">
        <StepperNav current={currentStep.key} furthestVisited={WIZARD_STEPS[furthestIndex]!.key} onSelect={goToStep} />

        <div className="space-y-6">
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm min-h-[300px]">
            {stepBody}
          </div>

          {!isReview && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                className="border-border/50 hover:bg-muted/50 transition-colors"
                disabled={stepIndex === 0 || saving}
                onClick={() => persistAndGo(stepIndex - 1)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                className="shadow-sm hover:shadow transition-all"
                disabled={saving}
                onClick={() => persistAndGo(stepIndex + 1)}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <>
                    Save &amp; Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
          {isReview && (
            <Button
              variant="outline"
              className="border-border/50 hover:bg-muted/50 transition-colors"
              disabled={saving}
              onClick={() => persistAndGo(stepIndex - 1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
        </div>

        <CampaignSummarySidebar draft={draft} groups={groups} contestTitle={contestTitle} currentStepKey={currentStep.key} />
      </div>
    </div>
  );
}
