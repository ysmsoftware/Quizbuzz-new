/**
 * Submissions API Functions
 * 
 * Maps directly to 10-submissions.md endpoints.
 * Base path: /submissions
 */

import { get, post } from './apiClient';
import type { ApiResponse } from './apiClient';

/**
 * GET /submissions/contests/:contestId
 * List all submissions for a contest
 */
export async function listSubmissions(
  contestId: string,
  params?: {
    status?: string;
    page?: number;
    limit?: number;
  }
): Promise<ApiResponse> {
  return get(`/submissions/contests/${contestId}`, params);
}

/**
 * GET /submissions/:submissionId
 * Full submission with answer breakdown
 */
export async function getSubmissionDetail(submissionId: string): Promise<ApiResponse> {
  return get(`/submissions/${submissionId}`);
}

/**
 * GET /submissions/participants/:participantId
 * Get a participant's submission
 */
export async function getParticipantSubmission(participantId: string): Promise<ApiResponse> {
  return get(`/submissions/participants/${participantId}`);
}

/**
 * POST /submissions/:submissionId/invalidate
 * Invalidate a submission
 */
export async function invalidateSubmission(
  submissionId: string,
  reason: string
): Promise<ApiResponse> {
  return post(`/submissions/${submissionId}/invalidate`, { reason });
}
