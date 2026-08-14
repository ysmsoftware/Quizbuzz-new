import type { CampaignPhase, CampaignPhaseTemplateEntry } from '@/lib/types/ambassador';

/** Adds N weeks to an ISO date string, returning a new ISO string. Shared by SpeedBonusEditor
 *  (campaignStartAt "N weeks after contest registration opens") and CampaignWizard's own
 *  contest-anchor sync effects, so both compute the same offset the same way. */
export function addWeeksIso(iso: string, weeks: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString();
}

/**
 * Mirrors the backend's generateCampaignPhases (campaign-timeline.ts) — used for the
 * wizard/dashboard live preview before anything has been saved, so it doesn't need a round
 * trip. Config-driven fraction breakdown of the total campaign duration, not hardcoded week
 * counts, so it scales to a campaign of any length.
 */
export const DEFAULT_PHASE_TEMPLATE: CampaignPhaseTemplateEntry[] = [
  { key: 'onboarding_launch', label: 'Ambassador Onboarding & Launch', fraction: 0.125 },
  { key: 'early_bird', label: 'Early Bird', fraction: 0.125 },
  { key: 'steady_push', label: 'Steady Push', fraction: 0.25 },
  { key: 'regular_deadline', label: 'Regular Deadline', fraction: 0.125 },
  { key: 'final_call', label: 'Final Call', fraction: 0.125 },
  { key: 'buffer_close', label: 'Buffer & Registration Close', fraction: 0.25 },
];

export function generateCampaignPhases(
  startDate: Date,
  endDate: Date,
  template: CampaignPhaseTemplateEntry[] = DEFAULT_PHASE_TEMPLATE
): CampaignPhase[] {
  const totalMs = endDate.getTime() - startDate.getTime();
  if (totalMs <= 0) return [];

  const phases: CampaignPhase[] = [];
  let cursor = startDate.getTime();
  for (const tpl of template) {
    const durationMs = totalMs * tpl.fraction;
    const startsAt = new Date(cursor);
    cursor += durationMs;
    phases.push({ key: tpl.key, label: tpl.label, startsAt: startsAt.toISOString(), endsAt: new Date(cursor).toISOString() });
  }

  const lastPhase = phases[phases.length - 1];
  if (lastPhase) lastPhase.endsAt = endDate.toISOString();

  return phases;
}
