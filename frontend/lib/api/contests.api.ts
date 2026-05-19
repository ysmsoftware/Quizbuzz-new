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
): Promise<ApiResponse<{ data: Registration[]; pagination?: any }>> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.status) query.append('status', params.status);
  if (params?.search) query.append('search', params.search);

  const path = `/contests/${contestId}/participants${
    query.toString() ? '?' + query.toString() : ''
  }`;
  return get<{ data: Registration[]; pagination?: any }>(path);
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
