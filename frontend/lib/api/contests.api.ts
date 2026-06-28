/**
 * Contests Management API Functions
 * 
 * Maps directly to 03-contests.md endpoints.
 * Base path: /contests
 */

import { del, get, patch, post } from './apiClient';
import type { ApiResponse } from './apiClient';
import type { Contest, Registration, ServerContest } from '../types';

/**
 * GET /contests
 */
export async function listContests(params?: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ApiResponse<{ data: Contest[]; pagination?: any }>> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.search) query.append('search', params.search);

  const path = `/contests${query.toString() ? '?' + query.toString() : ''}`;
  return get<{ data: Contest[]; pagination?: any }>(path);
}

/**
 * POST /contests
 */
export async function createContest(body: any): Promise<ApiResponse> {
  return post('/contests', body);
}

/**
 * GET /contests/:contestId
 */
export async function getContest(contestId: string): Promise<ApiResponse<ServerContest>> {
  return get<ServerContest>(`/contests/${contestId}`);
}

/**
 * PATCH /contests/:contestId
 */
export async function updateContest(contestId: string, body: any): Promise<ApiResponse> {
  return patch(`/contests/${contestId}`, body);
}

/**
 * DELETE /contests/:contestId
 */
export async function deleteContest(contestId: string): Promise<ApiResponse> {
  return del(`/contests/${contestId}`);
}

/**
 * POST /contests/:contestId/publish
 */
export async function publishContest(contestId: string): Promise<ApiResponse> {
  return post(`/contests/${contestId}/publish`);
}

/**
 * POST /contests/:contestId/close-registration
 */
export async function closeRegistration(contestId: string): Promise<ApiResponse<{ status: string }>> {
  return post<{ status: string }>(`/contests/${contestId}/close-registration`);
}

/**
 * PATCH /contests/:contestId/archive
 */
export async function archiveContest(contestId: string): Promise<ApiResponse> {
  return patch(`/contests/${contestId}/archive`);
}

/**
 * GET /contests/archived
 */
export async function listArchivedContests(params?: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ApiResponse<{ data: Contest[]; pagination?: any }>> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.search) query.append('search', params.search);

  const path = `/contests/archived${query.toString() ? '?' + query.toString() : ''}`;
  return get<{ data: Contest[]; pagination?: any }>(path);
}

/**
 * GET /contests/:contestId/participants
 */
export async function listParticipants(
  contestId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }
): Promise<ApiResponse<{ participants: Registration[]; pagination?: any }>> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.status) query.append('status', params.status);
  if (params?.search) query.append('search', params.search);

  const path = `/contests/${contestId}/participants${
    query.toString() ? '?' + query.toString() : ''
  }`;
  return get<{ participants: Registration[]; pagination?: any }>(path);
}

/**
 * GET /contests/:contestId/participants/:participantId
 */
export async function getParticipant(
  contestId: string,
  participantId: string
): Promise<ApiResponse> {
  return get(`/contests/${contestId}/participants/${participantId}`);
}

/**
 * PATCH /contests/:contestId/participants/:participantId/disqualify
 */
export async function disqualifyParticipant(
  contestId: string,
  participantId: string,
  reason: string
): Promise<ApiResponse> {
  return patch(`/contests/${contestId}/participants/${participantId}/disqualify`, { reason });
}

/**
 * GET /contests/:contestId/participants/status-summary
 */
export async function getParticipantStatusSummary(
  contestId: string
): Promise<ApiResponse<Record<string, number>>> {
  return get<Record<string, number>>(`/contests/${contestId}/participants/status-summary`);
}

/**
 * POST /contests/:contestId/participants/bulk-status
 */
export async function bulkUpdateParticipantStatus(
  contestId: string,
  participantIds: string[],
  status: 'REGISTERED' | 'DISQUALIFIED'
): Promise<ApiResponse<{ updatedCount: number }>> {
  return post<{ updatedCount: number }>(`/contests/${contestId}/participants/bulk-status`, {
    participantIds,
    status,
  });
}

/**
 * POST /contests/:contestId/participants/export
 */
export async function triggerExport(
  contestId: string,
  format: 'csv' | 'pdf',
  filters?: {
    search?: string;
    status?: string;
    payment?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<ApiResponse<any>> {
  return post<any>(`/contests/${contestId}/participants/export`, {
    format,
    filters,
  });
}

/**
 * GET /contests/:contestId/participants/export/:exportId
 */
export async function getExportStatus(
  contestId: string,
  exportId: string
): Promise<ApiResponse<{ status: string; progress: number; fileUrl: string | null; error: string | null; format: string }>> {
  return get<{ status: string; progress: number; fileUrl: string | null; error: string | null; format: string }>(`/contests/${contestId}/participants/export/${exportId}`);
}

/**
 * POST /contests/:contestId/evaluate
 */
export async function triggerEvaluation(contestId: string): Promise<ApiResponse> {
  return post(`/contests/${contestId}/evaluate`);
}

/**
 * POST /contests/:contestId/declare-results
 */
export async function declareResults(contestId: string): Promise<ApiResponse> {
  return post(`/contests/${contestId}/declare-results`);
}

/**
 * GET /contests/:contestId/leaderboard
 * Public endpoint — no auth required
 */
export async function getLeaderboard(
  contestId: string,
  params?: {
    page?: number;
    limit?: number;
  }
): Promise<ApiResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));

  const path = `/contests/${contestId}/leaderboard${
    query.toString() ? '?' + query.toString() : ''
  }`;
  return get(path);
}

/**
 * POST /contests/upload-banner
 */
export async function uploadBanner(body: { fileData: string; fileName: string }): Promise<ApiResponse<{ url: string }>> {
  return post<{ url: string }>('/contests/upload-banner', body);
}
