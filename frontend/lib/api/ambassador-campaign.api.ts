/**
 * Ambassador Program — org-admin API functions.
 * Base path: /org/ambassadors
 */

import { get, post, patch } from './apiClient';
import type { ApiResponse } from './apiClient';
import type {
  Ambassador,
  CampaignListItem,
  CampaignResult,
  AmbassadorStatus,
  PaginatedResult,
  RewardConfig,
  ShareTemplates,
  LeaderboardScope,
  LeaderboardEntryResult,
  ApplicationReportRow,
} from '../types/ambassador';

export interface ApplicationsFilters {
  status?: AmbassadorStatus | string; // comma-separated multi-value, e.g. "PENDING,SUSPENDED"
  page?: number;
  limit?: number;
  sortBy?: 'appliedAt' | 'firstName';
  sortOrder?: 'asc' | 'desc';
}

export interface CampaignsFilters {
  status?: 'ACTIVE' | 'ARCHIVED';
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ReportFilters {
  page?: number;
  limit?: number;
  sortBy?: 'registrationCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export const ambassadorCampaignApi = {
  uploadPoster: (body: { fileData: string; fileName: string }) =>
    post<{ url: string; key: string }>('/org/ambassadors/campaigns/upload-poster', body),

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
    get<PaginatedResult<CampaignListItem>>('/org/ambassadors/campaigns', { params: params as Record<string, string | number | boolean | undefined> }),

  getCampaign: (id: string) =>
    get<CampaignResult>(`/org/ambassadors/campaigns/${id}`),

  createCampaign: (body: {
    contestId: string;
    name: string;
    ambassadorTypesAllowed: string[];
    rewardConfig: RewardConfig;
    shareTemplates: ShareTemplates;
  }) => post<CampaignResult>('/org/ambassadors/campaigns', body),

  updateCampaign: (
    id: string,
    body: Partial<{
      name: string;
      ambassadorTypesAllowed: string[];
      rewardConfig: RewardConfig;
      shareTemplates: ShareTemplates;
      status: 'ACTIVE' | 'ARCHIVED';
    }>
  ) => patch<CampaignResult>(`/org/ambassadors/campaigns/${id}`, body),

  duplicateCampaign: (id: string, contestId: string) =>
    post<CampaignResult>(`/org/ambassadors/campaigns/${id}/duplicate`, { contestId }),

  getReport: (id: string, params?: ReportFilters) =>
    get<PaginatedResult<ApplicationReportRow>>(`/org/ambassadors/campaigns/${id}/report`, { params: params as Record<string, string | number | boolean | undefined> }),

  // Returns a raw CSV file (Content-Disposition: attachment), not the JSON
  // envelope — used directly as an <a href> download link, never fetched via apiClient.
  getReportExportUrl: (id: string) =>
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1'}/org/ambassadors/campaigns/${id}/report/export`,

  getLeaderboard: (id: string, scope: LeaderboardScope, params?: { page?: number; limit?: number }) =>
    get<PaginatedResult<LeaderboardEntryResult>>(`/org/ambassadors/campaigns/${id}/leaderboard`, {
      params: { scope, ...params },
    }),
};

export type { ApiResponse };
