import type { AmbassadorCampaignStatus } from '@/lib/types/ambassador';

/**
 * Mirrors the backend's CAMPAIGN_FIELD_EDITABLE_STATUSES (ambassador-campaign.validator.ts)
 * so the management dashboard can disable fields proactively instead of only finding out
 * via a failed PATCH. The backend remains the source of truth and enforces this
 * independently — this copy is purely for UX, never trusted for anything security-relevant.
 */
export const CAMPAIGN_FIELD_EDITABLE_STATUSES: Record<string, AmbassadorCampaignStatus[]> = {
  contestId: ['DRAFT'],
  ambassadorTypesAllowed: ['DRAFT'],
  // Not part of the campaign PATCH (lives in its own table/endpoint — see
  // ambassador-campaign.service.ts#replaceGroups) but shares rewardConfig's lock window since
  // structure feeds capacity/targets, just as economically meaningful once a campaign is live.
  groups: ['DRAFT', 'PUBLISHED'],
  rewardConfig: ['DRAFT', 'PUBLISHED'],
  name: ['DRAFT', 'PUBLISHED', 'LIVE'],
  shareTemplates: ['DRAFT', 'PUBLISHED', 'LIVE'],
  // Timeline — same window as rewardConfig/groups: locked once LIVE so phase boundaries don't
  // move under a campaign that's already running.
  startDate: ['DRAFT', 'PUBLISHED'],
  endDate: ['DRAFT', 'PUBLISHED'],
};

export function isFieldEditable(field: keyof typeof CAMPAIGN_FIELD_EDITABLE_STATUSES, status: AmbassadorCampaignStatus): boolean {
  return CAMPAIGN_FIELD_EDITABLE_STATUSES[field]?.includes(status) ?? false;
}
