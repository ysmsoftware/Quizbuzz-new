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
      // Classify Timeline's start/end mode from whatever's already saved. If the contests
      // list hasn't finished loading yet, the anchor lookups below just come back undefined —
      // inferInitialStartMode/EndMode treat that as "unknown," not "no match," and fall back
      // to CUSTOM rather than risk the sync effect further down overwriting an already-saved
      // date once the contest data does arrive.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the `contests` closure deliberately without re-running this once-only hydration effect on every contests refetch
      const resumedContest = contests.find((c) => c.id === campaign.contestId);
      setStartMode(inferInitialStartMode(campaign.startDate ?? '', resumedContest?.publishedAt || resumedContest?.registrationStartDate || undefined));
      setEndMode(inferInitialEndMode(campaign.endDate ?? '', resumedContest?.contestEndTime || undefined, resumedContest?.contestStartTime || undefined));
      const resumeIndex = Math.min(Math.max(campaign.wizardStep - 1, 0), WIZARD_STEPS.length - 1);
      setStepIndex(resumeIndex);
      setFurthestIndex(resumeIndex);
      setHydrated(true);
    }
  }, [campaignId, campaign, hydrated]);

  // Guard against the wizard being reached (e.g. a stale bookmark/deep link) for a campaign
  // that's no longer wizard-editable. The wizard resends the whole draft — including
  // ambassadorTypesAllowed/wizardStep, which are DRAFT-only per CAMPAIGN_FIELD_EDITABLE_STATUSES
  // — on every step save, so a LIVE/ENDED/ARCHIVED campaign here would 400 on the very first
  // Continue click. DRAFT and PUBLISHED are both fine: everything the wizard touches (reward
  // config, timeline, share templates, name) stays editable through PUBLISHED.
  useEffect(() => {
    if (campaign && campaign.status !== 'DRAFT' && campaign.status !== 'PUBLISHED') {
      toast.error('This campaign is already live and can no longer be edited in the wizard.');
      router.replace('/org/ambassadors');
    }
  }, [campaign, router]);

  // Groups only exist once the campaign row does — seed local state from whatever's already
  // saved the first time the fetch resolves for this id (covers both "resuming a draft that
  // already has groups" and "just created the campaign, groups are empty").
  useEffect(() => {
    if (id && !groupsLoading && !groupsHydrated) {
      setGroups(fetchedGroups.map((g) => ({ groupType: g.groupType, name: g.name, ambassadorTarget: g.ambassadorTarget, registrationTarget: g.registrationTarget })));
      setGroupsHydrated(true);
    }
  }, [id, groupsLoading, groupsHydrated, fetchedGroups]);

  // Speed Bonus's campaignStartAt — kept in sync with the promoted contest's registration
  // start (or an N-week offset) whenever the admin hasn't chosen a custom date, regardless of
  // which wizard step is currently open. This lives here rather than inside SpeedBonusEditor
  // because that component unmounts whenever the admin leaves the Rewards step — reselecting
  // the contest from Promotion (or enabling Speed Bonus before ever picking a contest) could
  // otherwise leave campaignStartAt blank all the way to Review & Publish, since nothing would
  // be mounted to notice the contest had changed. See ambassador-campaign.validator.ts's
  // speedBonusSchema for the strict "campaignStartAt is required once enabled" check this feeds.
  useEffect(() => {
    const speedBonus = draft.rewardConfig.speedBonus;
    if (!speedBonus?.enabled) return;
    const mode = speedBonus.campaignStartAtMode ?? 'CONTEST_START';
    if (mode === 'CUSTOM') return;
    const anchor = selectedContest?.registrationStartDate;
    if (!anchor) return;
    const resolved = mode === 'OFFSET_WEEKS' ? addWeeksIso(anchor, speedBonus.campaignStartAtOffsetWeeks ?? 0) : anchor;
    if (resolved !== speedBonus.campaignStartAt) {
      setDraft((d) => ({ ...d, rewardConfig: { ...d.rewardConfig, speedBonus: { ...speedBonus, campaignStartAt: resolved } } }));
    }
  }, [draft.rewardConfig.speedBonus, selectedContest?.registrationStartDate]);

  // Timeline's start/end dates — same "sync lives where it stays mounted" fix as Speed Bonus's
  // campaignStartAt above, for the identical reason: TimelineStep unmounts whenever the admin
  // leaves the Timeline step, so reselecting the contest from Promotion wouldn't otherwise be
  // picked back up until the admin happened to revisit Timeline.
  useEffect(() => {
    if (startMode === 'CUSTOM') return;
    const anchor = selectedContest?.publishedAt || selectedContest?.registrationStartDate || undefined;
    if (anchor && anchor !== draft.startDate) {
      setDraft((d) => ({ ...d, startDate: anchor }));
    }
  }, [startMode, selectedContest?.publishedAt, selectedContest?.registrationStartDate, draft.startDate]);

  useEffect(() => {
    if (endMode === 'CUSTOM') return;
    const anchor = endMode === 'CONTEST_START' ? selectedContest?.contestStartTime : selectedContest?.contestEndTime;
    if (anchor && anchor !== draft.endDate) {
      setDraft((d) => ({ ...d, endDate: anchor }));
    }
  }, [endMode, selectedContest?.contestStartTime, selectedContest?.contestEndTime, draft.endDate]);

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
          startDate: draft.startDate || undefined,
          endDate: draft.endDate || undefined,
          phaseTemplate: draft.phaseTemplate,
        });
        const newId = res.data.id;
        setId(newId);
        router.replace(`/org/ambassadors/campaigns/${newId}/wizard`);
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
        // Groups only exist once the campaign row does, so this only runs from here on —
        // same "always send the whole accumulated state" approach as the campaign PATCH above.
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
      router.push('/org/ambassadors');
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
            contestRegistrationStartDate={selectedContest?.registrationStartDate}
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
            contest={selectedContest}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep.key, draft, groups, contestTitle, selectedContest, startMode, endMode, publishCampaignLoading, publishErrors, stepErrors, campaign]);

  const isWizardLocked = !!campaign && campaign.status !== 'DRAFT' && campaign.status !== 'PUBLISHED';
  if (campaignId && (isLoading || !hydrated || isWizardLocked)) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  const isReview = currentStep.key === 'review';

  return (
    <div className="max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push('/org/ambassadors')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Ambassadors
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">{campaign ? campaign.name || 'Edit Campaign' : 'New Ambassador Campaign'}</h1>
        <p className="text-sm text-muted-foreground">Build the campaign step by step — you can save and come back anytime before publishing.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_260px] gap-6 items-start">
        <StepperNav current={currentStep.key} furthestVisited={WIZARD_STEPS[furthestIndex]!.key} onSelect={goToStep} />

        <div className="space-y-4">
          {stepBody}

          {!isReview && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" disabled={stepIndex === 0 || saving} onClick={() => persistAndGo(stepIndex - 1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button disabled={saving} onClick={() => persistAndGo(stepIndex + 1)}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save &amp; Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
          {isReview && (
            <Button variant="outline" disabled={saving} onClick={() => persistAndGo(stepIndex - 1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
        </div>

        <CampaignSummarySidebar draft={draft} groups={groups} contestTitle={contestTitle} />
      </div>
    </div>
  );
}
