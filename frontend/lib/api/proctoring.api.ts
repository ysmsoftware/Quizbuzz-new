/**
 * Proctoring API Functions
 * 
 * Maps directly to backend endpoints.
 * Base path: /proctoring
 */

import { get, patch } from './apiClient';
import type { ApiResponse } from './apiClient';

/**
 * GET /proctoring/contests/:contestId/overview
 * Aggregate proctoring summary
 */
export async function getProctoringOverview(contestId: string): Promise<ApiResponse<any>> {
  const res = await get<{ totalEvents: number; flaggedParticipants: number; eventsByType: any }>(
    `/proctoring/contests/${contestId}/overview`
  );
  return {
    ...res,
    data: {
      totalViolations: res.data.totalEvents,
      flaggedCount: res.data.flaggedParticipants,
      byType: res.data.eventsByType
    }
  };
}

/**
 * GET /proctoring/contests/:contestId/flagged
 * List flagged participants
 */
export async function listFlaggedParticipants(
  contestId: string,
  params?: {
    page?: number;
    limit?: number;
  }
): Promise<ApiResponse<{ data: any[]; pagination?: any }>> {
  const res = await get<{ scores: any[]; total: number }>(`/proctoring/contests/${contestId}/flagged`, { params });
  return {
    ...res,
    data: {
      data: res.data.scores,
      pagination: {
        total: res.data.total,
        page: params?.page ?? 1,
        limit: params?.limit ?? 10
      }
    }
  };
}

/**
 * GET /proctoring/contests/:contestId/participants/:participantId/events
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
  const participantId = params?.participantId || '';
  return get(`/proctoring/contests/${contestId}/participants/${participantId}/events`, { params });
}

/**
 * GET /proctoring/contests/:contestId/participants/:participantId/events
 * Single participant proctoring detail
 */
export async function getParticipantProctoringDetail(
  contestId: string,
  participantId: string
): Promise<ApiResponse> {
  return get(`/proctoring/contests/${contestId}/participants/${participantId}/events`);
}

/**
 * PATCH /proctoring/scores/:scoreId/status
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
  // Fetch flagged participants to find the scoreId mapping for the participant
  const flaggedRes = await get<{ scores: any[]; total: number }>(`/proctoring/contests/${contestId}/flagged`);
  const scoreRecord = flaggedRes.data.scores.find((s) => s.participantId === participantId);
  
  if (!scoreRecord) {
    throw new Error(`Could not find proctoring score record for participant ${participantId}`);
  }
  
  // Patch the score status using the mapped scoreId
  return patch(`/proctoring/scores/${scoreRecord.id}/status`, {
    isDismissed: body.dismiss
  });
}

/**
 * GET /proctoring/contests/:contestId/participants/:participantId/captures
 * Admin-only: returns snapshot evidence with presigned read URLs
 */
export async function getParticipantCaptures(
  contestId: string,
  participantId: string,
): Promise<ApiResponse<{ captures: Array<{ id: string; captureType: string; capturedAt: string; presignedGetUrl: string }> }>> {
  return get(`/proctoring/contests/${contestId}/participants/${participantId}/captures`);
}
