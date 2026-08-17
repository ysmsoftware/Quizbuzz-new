import type { AmbassadorTypeDefinition, CampaignPhaseTemplateEntry, DraftRewardConfig, ShareTemplates } from '@/lib/types/ambassador';

export type StepKey = 'basics' | 'promotion' | 'structure' | 'rewards' | 'leaderboards' | 'timeline' | 'kit' | 'review';

export interface StepDef {
  key: StepKey;
  label: string;
  required: boolean;
}

// Ambassador Structure is marked optional: it's a capacity-planning aid, not a publish
// blocker — a campaign can go live with zero groups defined, same as before this step
// existed. Timeline (Phase 4) is required: start/end dates drive the auto-generated phase
// preview and are enforced by the backend's PublishCampaignSchema.
export const WIZARD_STEPS: StepDef[] = [
  { key: 'basics', label: 'Basics', required: true },
  { key: 'promotion', label: 'Promotion', required: true },
  { key: 'structure', label: 'Ambassador Structure', required: false },
  { key: 'rewards', label: 'Rewards', required: true },
  { key: 'leaderboards', label: 'Leaderboards', required: false },
  { key: 'timeline', label: 'Timeline', required: true },
  { key: 'kit', label: 'Ambassador Kit', required: false },
  { key: 'review', label: 'Review & Publish', required: true },
];

/** Everything the wizard edits, mirrored in one place so each step reads/writes a slice of it. */
export interface WizardDraft {
  name: string;
  contestId: string;
  ambassadorTypesAllowed: string[];
  rewardConfig: DraftRewardConfig;
  shareTemplates: ShareTemplates;
  startDate: string; // ISO, '' until set
  endDate: string; // ISO, '' until set
  phaseTemplate: CampaignPhaseTemplateEntry[] | null; // null = use the built-in default
}

export const EMPTY_DRAFT: WizardDraft = {
  name: '',
  contestId: '',
  ambassadorTypesAllowed: [],
  rewardConfig: { currency: 'INR', milestoneTiers: [], leaderboardPrizes: [] },
  shareTemplates: {},
  startDate: '',
  endDate: '',
  phaseTemplate: null,
};

/** Maps a validation-error field path (from Zod `details`, e.g. "rewardConfig.milestoneTiers.0.amountPerRegistration")
 *  back to the wizard step it belongs to, so the Review step can deep-link into the right place. */
export function stepForErrorPath(path: string): StepKey {
  if (path === 'name') return 'basics';
  if (path === 'contestId' || path === 'ambassadorTypesAllowed') return 'promotion';
  if (path === 'startDate' || path === 'endDate' || path.startsWith('phaseTemplate')) return 'timeline';
  if (path.startsWith('rewardConfig.leaderboardPrizes')) return 'leaderboards';
  if (path.startsWith('rewardConfig')) return 'rewards';
  if (path.startsWith('shareTemplates')) return 'kit';
  return 'review';
}

export function stepLabel(key: StepKey): string {
  return WIZARD_STEPS.find((s) => s.key === key)?.label ?? key;
}

export type AmbassadorTypesByKey = Record<string, AmbassadorTypeDefinition>;
