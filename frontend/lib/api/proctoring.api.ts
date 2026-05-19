/**
 * Proctoring API Functions
 * 
 * Maps directly to 12-proctoring.md endpoints.
 * Base path: /proctoring
 */

import { get, patch } from './apiClient';
import type { ApiResponse } from './apiClient';

/**
 * GET /proctoring/:contestId/overview
 * Aggregate proctoring summary
 */
export async function getProctoringOverview(contestId: string): Promise<ApiResponse> {
  return get(`/proctoring/${contestId}/overview`);
}

/**
 * GET /proctoring/:contestId/flagged
 * List flagged participants
 */
export async function listFlaggedParticipants(
  contestId: string,
  params?: {
    page?: number;
    limit?: number;
  }
): Promise<ApiResponse<{ data: any[]; pagination?: any }>> {
  return get<{ data: any[]; pagination?: any }>(`/proctoring/${contestId}/flagged`, { params });
}

/**
 * GET /proctoring/:contestId/events
 * Full violation event log
 */
export async function listProctoringEvents(
  contestId: string,
  params?: {
    participantId?: string;
    type?: string;
    severity?: number;
    dismissed?: boolean;
    page?: number;
    limit?: number;
  }
): Promise<ApiResponse> {
  return get(`/proctoring/${contestId}/events`, { params });
}

/**
 * GET /proctoring/:contestId/participant/:participantId
 * Single participant proctoring detail
 */
export async function getParticipantProctoringDetail(
  contestId: string,
  participantId: string
): Promise<ApiResponse> {
  return get(`/proctoring/${contestId}/participant/${participantId}`);
}

/**
 * PATCH /proctoring/:contestId/participant/:participantId/review
 * Mark violations as reviewed/dismissed
 */
export async function reviewViolations(
  contestId: string,
  participantId: string,
  body: {
    dismiss: boolean;
    eventIds: string[];
    note?: string;
  }
): Promise<ApiResponse> {
  return patch(`/proctoring/${contestId}/participant/${participantId}/review`, body);
}
