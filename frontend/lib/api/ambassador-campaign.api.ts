/**
 * Ambassador Program — org-admin API functions.
 * Base path: /org/ambassadors
 */

import { get, post, patch, put, del } from './apiClient';
import type { ApiResponse } from './apiClient';
import type {
  Ambassador,
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
} from '../types/ambassador';
import { leaderboardScopeQueryParams } from '../types/ambassador';

export interface ApplicationsFilters {
  status?: AmbassadorStatus | string; // comma-separated multi-value, e.g. "PENDING,SUSPENDED"
  page?: number;
  limit?: number;
  sortBy?: 'appliedAt' | 'firstName';
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
    post<{ url: string; storageKey: string }>('/org/ambassadors/campaigns/poster-upload-url', body),

  // Applications
  getApplications: (params?: ApplicationsFilters) =>
    get<PaginatedResult<Ambassador>>('/org/ambassadors/applications', { params: params as Record<string, string | number | boolean | undefined> }),

  getApplication: (id: string) =>
    get<Ambassador & { proofDownloadUrl: string }>(`/org/ambassadors/applications/${id}`),

  approveApplication: (id: string) =>
    post<Ambassador>(`/org/ambassadors/applications/${id}/approve`),

  rejectApplication: (id: string, reason: string) =>
    post<Ambassador>(`/org/ambassadors/applications/${id}/reject`, { reason }),

  // Campaigns
  getCampaigns: (params?: CampaignsFilters) =>
    get<PaginatedResult<CampaignListItem>>('/org/ambassadors/campaigns', {
      params: {
        ...params,
        status: Array.isArray(params?.status) ? params.status.join(',') : params?.status,
      } as Record<string, string | number | boolean | undefined>,
    }),

  getCampaign: (id: string) =>
    get<CampaignResult>(`/org/ambassadors/campaigns/${id}`),

  // Starts a DRAFT — only `name` is required. The creation wizard fills in the rest one
  // step at a time via updateCampaign(), then finalizes with publishCampaign().
  createCampaign: (body: {
    name: string;
    contestId?: string;
    ambassadorTypesAllowed?: string[];
    rewardConfig?: DraftRewardConfig;
    shareTemplates?: ShareTemplates;
    startDate?: string; // ISO
    endDate?: string; // ISO
    phaseTemplate?: CampaignPhaseTemplateEntry[] | null;
  }) => post<CampaignResult>('/org/ambassadors/campaigns', body),

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
  ) => patch<CampaignResult>(`/org/ambassadors/campaigns/${id}`, body),

  // DRAFT -> PUBLISHED. Validated server-side against the campaign's accumulated state;
  // a 400 VALIDATION_ERROR response carries per-field `details` the Review step uses to
  // deep-link back into the wizard.
  publishCampaign: (id: string) =>
    post<CampaignResult>(`/org/ambassadors/campaigns/${id}/publish`),

  // PUBLISHED -> LIVE — ambassadors can see and join the campaign.
  activateCampaign: (id: string) =>
    post<CampaignResult>(`/org/ambassadors/campaigns/${id}/activate`),

  // LIVE -> ENDED — locks reward economics; report/leaderboard stay readable.
  endCampaign: (id: string) =>
    post<CampaignResult>(`/org/ambassadors/campaigns/${id}/end`),

  // Any non-terminal status -> ARCHIVED. One-way.
  archiveCampaign: (id: string) =>
    post<CampaignResult>(`/org/ambassadors/campaigns/${id}/archive`),

  duplicateCampaign: (id: string, contestId: string) =>
    post<CampaignResult>(`/org/ambassadors/campaigns/${id}/duplicate`, { contestId }),

  // Ambassador Structure — replace-all, not per-row CRUD (see ReplaceGroupsSchema on the backend).
  getGroups: (id: string) =>
    get<{ groups: AmbassadorGroupResult[]; capacity: CampaignCapacity }>(`/org/ambassadors/campaigns/${id}/groups`),

  replaceGroups: (id: string, groups: AmbassadorGroupInput[]) =>
    put<{ groups: AmbassadorGroupResult[]; capacity: CampaignCapacity }>(`/org/ambassadors/campaigns/${id}/groups`, { groups }),

  getReport: (id: string, params?: ReportFilters) =>
    get<PaginatedResult<ApplicationReportRow>>(`/org/ambassadors/campaigns/${id}/report`, { params: params as Record<string, string | number | boolean | undefined> }),

  // Returns a raw CSV file (Content-Disposition: attachment), not the JSON
  // envelope — used directly as an <a href> download link, never fetched via apiClient.
  getReportExportUrl: (id: string) =>
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1'}/org/ambassadors/campaigns/${id}/report/export`,

  getLeaderboard: (id: string, scope: LeaderboardScope, params?: { page?: number; limit?: number }) =>
    get<PaginatedResult<LeaderboardEntryResult>>(`/org/ambassadors/campaigns/${id}/leaderboard`, {
      params: { ...leaderboardScopeQueryParams(scope), ...params },
    }),

  // Campaign Templates — reusable config snapshots (§3.4, Phase 5). Timeline dates are
  // deliberately not part of a template; only ambassador types, reward config, share
  // templates, and structure are captured.
  getTemplates: (params?: TemplatesFilters) =>
    get<PaginatedResult<CampaignTemplate>>('/org/ambassadors/campaign-templates', { params: params as Record<string, string | number | boolean | undefined> }),

  createTemplate: (body: { sourceCampaignId: string; name: string }) =>
    post<CampaignTemplate>('/org/ambassadors/campaign-templates', body),

  deleteTemplate: (id: string) =>
    del<null>(`/org/ambassadors/campaign-templates/${id}`),

  instantiateTemplate: (id: string, body?: { contestId?: string; name?: string }) =>
    post<CampaignResult>(`/org/ambassadors/campaign-templates/${id}/instantiate`, body),
};

export type { ApiResponse };
