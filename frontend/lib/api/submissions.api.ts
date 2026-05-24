/**
 * Submissions API Functions
 * 
 * Maps directly to backend endpoints.
 * Base path: /admin/contests or /admin/submissions or /submissions
 */

import { get, post, patch } from './apiClient';
import type { ApiResponse } from './apiClient';

/**
 * GET /admin/contests/:contestId/submissions
 * List all submissions for a contest
 */
export async function listSubmissions(
  contestId: string,
  params?: {
    status?: string;
    page?: number;
    limit?: number;
  }
): Promise<ApiResponse<{ data: any[]; pagination: any; summary?: any }>> {
  const res = await get<any>(`/admin/contests/${contestId}/submissions`, { params });
  return {
    success: true,
    data: {
      data: res.data,
      pagination: (res as any).pagination || { page: 1, limit: 50, total: 0, totalPages: 1 }
    }
  };
}

/**
 * GET /admin/submissions/:submissionId
 * Full submission with answer breakdown
 */
export async function getSubmissionDetail(submissionId: string): Promise<ApiResponse> {
  return get(`/admin/submissions/${submissionId}`);
}

export async function getParticipantSubmission(
  participantId: string,
  params?: { contestId?: string; contestSlug?: string }
): Promise<ApiResponse<any>> {
  return get(`/submissions/me/${participantId}`, { params });
}

/**
 * PATCH /admin/submissions/:submissionId/invalidate
 * Invalidate a submission
 */
export async function invalidateSubmission(
  submissionId: string,
  reason: string
): Promise<ApiResponse> {
  return patch(`/admin/submissions/${submissionId}/invalidate`, { reason });
}

/**
 * GET /contests/:contestId/leaderboard
 * Public leaderboard for a contest
 */
export async function getPublicLeaderboard(
  contestId: string,
  params?: { page?: number; limit?: number }
): Promise<ApiResponse<{ entries: any[]; pagination: any }>> {
  return get(`/contests/${contestId}/leaderboard`, { params });
}
