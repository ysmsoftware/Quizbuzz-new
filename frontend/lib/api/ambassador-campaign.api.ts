/**
 * Ambassador Program — org-admin API functions.
 * Two base paths, on purpose (see backend routes.ts): /org/ambassadors is people —
 * reviewing applications and the org-wide ambassador directory — while /org/campaigns is
 * campaign management. They used to share one nested path (campaign endpoints lived under
 * /org/ambassadors/campaigns/*); split so each URL says what it's actually addressing.
 */

import { get, post, patch, put, del } from './apiClient';
import type { ApiResponse } from './apiClient';
import type {
  ApplicationResult,
  AmbassadorCampaignStatus,
  AmbassadorGroupInput,
  AmbassadorGroupResult,
  CampaignCapacity,
  CampaignListItem,
  CampaignResult,
  CampaignTemplate,
  AmbassadorStatus,
  PaginatedResult,
  DraftRewardConfig,
  ShareTemplates,
  CampaignPhaseTemplateEntry,
  LeaderboardScope,
  LeaderboardEntryResult,
  ApplicationReportRow,
  CampaignStatsSummary,
  OrgAmbassadorListItem,
  OrgAmbassadorProfile,
} from '../types/ambassador';
import { leaderboardScopeQueryParams } from '../types/ambassador';

export interface ApplicationsFilters {
  status?: AmbassadorStatus | string; // comma-separated multi-value, e.g. "PENDING,SUSPENDED"
  page?: number;
  limit?: number;
  sortBy?: 'appliedAt' | 'firstName';
  sortOrder?: 'asc' | 'desc';
}

export interface OrgAmbassadorsFilters {
  q?: string;
  ambassadorType?: string;
  campaignId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'joinedAt' | 'name' | 'registrations';
  sortOrder?: 'asc' | 'desc';
}

export interface CampaignsFilters {
  status?: AmbassadorCampaignStatus | AmbassadorCampaignStatus[];
  ambassadorType?: string;
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'name' | 'startDate' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ReportFilters {
  page?: number;
  limit?: number;
  sortBy?: 'registrationCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TemplatesFilters {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export const ambassadorCampaignApi = {
  // Presigned-PUT-URL flow — the caller PUTs the raw file straight to S3 with the returned
  // `url`, then strips the query string off it to get the permanent object URL to save
  // (see ShareTemplatesEditor.tsx's handlePosterSelect, mirrors the ambassador-proof upload
  // flow in app/ambassador/[orgSlug]/apply/page.tsx).
  getPosterUploadUrl: (body: { filename: string; mimeType: string }) =>
    post<{ url: string; storageKey: string }>('/org/campaigns/poster-upload-url', body),

  // Applications — per-campaign (an ambassador's applicant identity is shared across orgs,
  // but each campaign's org reviews its own applications independently).
  getApplications: (params?: ApplicationsFilters) =>
    get<PaginatedResult<ApplicationResult>>('/org/ambassadors/applications', { params: params as Record<string, string | number | boolean | undefined> }),

  getApplication: (id: string) =>
    get<ApplicationResult & { proofDownloadUrl: string }>(`/org/ambassadors/applications/${id}`),

  approveApplication: (id: string) =>
    post<ApplicationResult>(`/org/ambassadors/applications/${id}/approve`),

  rejectApplication: (id: string, reason: string) =>
    post<ApplicationResult>(`/org/ambassadors/applications/${id}/reject`, { reason }),

  // Ambassador directory — org-wide, across every campaign this org owns. One row per
  // distinct APPROVED ambassador, as opposed to getApplications above (per-campaign review
  // queue, any status, one row per enrollment).
  getOrgAmbassadors: (params?: OrgAmbassadorsFilters) =>
    get<PaginatedResult<OrgAmbassadorListItem>>('/org/ambassadors', { params: params as Record<string, string | number | boolean | undefined> }),

  getOrgAmbassador: (ambassadorId: string) =>
    get<OrgAmbassadorProfile>(`/org/ambassadors/${ambassadorId}`),

  // Campaigns
  getCampaigns: (params?: CampaignsFilters) =>
    get<PaginatedResult<CampaignListItem>>('/org/campaigns', {
      params: {
        ...params,
        status: Array.isArray(params?.status) ? params.status.join(',') : params?.status,
      } as Record<string, string | number | boolean | undefined>,
    }),

  getCampaign: (id: string) =>
    get<CampaignResult>(`/org/campaigns/${id}`),

  // Starts a DRAFT — only `name` is required. The creation wizard fills in the rest one
  // step at a time via updateCampaign(), then finalizes with publishCampaign().
  createCampaign: (body: {
    name: string;
    contestId?: string;
    ambassadorTypesAllowed?: string[];
    rewardConfig?: DraftRewardConfig;
    shareTemplates?: ShareTemplates;
    // Lets the wizard's first Save & Continue create the row already pointed at the target
    // step, instead of always defaulting to 1 (Basics) server-side — see CampaignWizard's
    // persistAndGo, which remounts on the create's router.replace and would otherwise
    // re-hydrate from a stale wizardStep and appear to "do nothing" on the first click.
    wizardStep?: number;
    startDate?: string; // ISO
    endDate?: string; // ISO
    phaseTemplate?: CampaignPhaseTemplateEntry[] | null;
  }) => post<CampaignResult>('/org/campaigns', body),

  // `status` is deliberately not settable here — every transition goes through its own
  // dedicated action below, each with its own preconditions (see the backend's
  // CAMPAIGN_FIELD_EDITABLE_STATUSES table for which of these fields a PATCH can touch,
  // depending on the campaign's current status).
  updateCampaign: (
    id: string,
    body: Partial<{
      name: string;
      contestId: string;
      ambassadorTypesAllowed: string[];
      rewardConfig: DraftRewardConfig;
      shareTemplates: ShareTemplates;
      wizardStep: number;
      startDate: string; // ISO
      endDate: string; // ISO
      phaseTemplate: CampaignPhaseTemplateEntry[] | null;
    }>
  ) => patch<CampaignResult>(`/org/campaigns/${id}`, body),

  // DRAFT -> PUBLISHED. Validated server-side against the campaign's accumulated state;
  // a 400 VALIDATION_ERROR response carries per-field `details` the Review step uses to
  // deep-link back into the wizard.
  publishCampaign: (id: string) =>
    post<CampaignResult>(`/org/campaigns/${id}/publish`),

  // PUBLISHED -> LIVE — ambassadors can see and join the campaign.
  activateCampaign: (id: string) =>
    post<CampaignResult>(`/org/campaigns/${id}/activate`),

  // LIVE -> ENDED — locks reward economics; report/leaderboard stay readable.
  endCampaign: (id: string) =>
    post<CampaignResult>(`/org/campaigns/${id}/end`),

  // Any non-terminal status -> ARCHIVED. One-way.
  archiveCampaign: (id: string) =>
    post<CampaignResult>(`/org/campaigns/${id}/archive`),

  duplicateCampaign: (id: string, contestId: string) =>
    post<CampaignResult>(`/org/campaigns/${id}/duplicate`, { contestId }),

  // Ambassador Structure — replace-all, not per-row CRUD (see ReplaceGroupsSchema on the backend).
  getGroups: (id: string) =>
    get<{ groups: AmbassadorGroupResult[]; capacity: CampaignCapacity }>(`/org/campaigns/${id}/groups`),

  replaceGroups: (id: string, groups: AmbassadorGroupInput[]) =>
    put<{ groups: AmbassadorGroupResult[]; capacity: CampaignCapacity }>(`/org/campaigns/${id}/groups`, { groups }),

  getReport: (id: string, params?: ReportFilters) =>
    get<PaginatedResult<ApplicationReportRow>>(`/org/campaigns/${id}/report`, { params: params as Record<string, string | number | boolean | undefined> }),

  // Dashboard aggregate — totals/tier-counts/recently-joined computed over every approved
  // enrollment, not a paginated report page. Use this for campaign-wide sums; use getReport
  // only for the ranked/paginated ambassador list itself.
  getCampaignStats: (id: string) =>
    get<CampaignStatsSummary>(`/org/campaigns/${id}/stats`),

  // Returns a raw CSV file (Content-Disposition: attachment), not the JSON
  // envelope — used directly as an <a href> download link, never fetched via apiClient.
  getReportExportUrl: (id: string) =>
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1'}/org/campaigns/${id}/report/export`,

  getLeaderboard: (id: string, scope: LeaderboardScope, params?: { page?: number; limit?: number }) =>
    get<PaginatedResult<LeaderboardEntryResult>>(`/org/campaigns/${id}/leaderboard`, {
      params: { ...leaderboardScopeQueryParams(scope), ...params },
    }),

  // Campaign Templates — reusable config snapshots (§3.4, Phase 5). Timeline dates are
  // deliberately not part of a template; only ambassador types, reward config, share
  // templates, and structure are captured.
  getTemplates: (params?: TemplatesFilters) =>
    get<PaginatedResult<CampaignTemplate>>('/org/campaigns/templates', { params: params as Record<string, string | number | boolean | undefined> }),

  createTemplate: (body: { sourceCampaignId: string; name: string }) =>
    post<CampaignTemplate>('/org/campaigns/templates', body),

  deleteTemplate: (id: string) =>
    del<null>(`/org/campaigns/templates/${id}`),

  instantiateTemplate: (id: string, body?: { contestId?: string; name?: string }) =>
    post<CampaignResult>(`/org/campaigns/templates/${id}/instantiate`, body),
};

export type { ApiResponse };
