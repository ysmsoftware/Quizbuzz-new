/**
 * Analytics API Functions
 * 
 * Maps directly to 11-analytics.md endpoints.
 * Base path: /analytics
 */

import { get, post } from './apiClient';
import type { ApiResponse } from './apiClient';

/**
 * GET /analytics/:contestId
 * Full analytics snapshot for a contest
 */
export async function getContestAnalytics(contestId: string): Promise<ApiResponse> {
  return get(`/analytics/${contestId}`);
}

/**
 * GET /analytics/:contestId/live
 * Real-time live count from Redis
 */
export async function getLiveAnalytics(contestId: string): Promise<ApiResponse> {
  return get(`/analytics/${contestId}/live`);
}

/**
 * GET /analytics/:contestId/score-distribution
 * Score histogram data
 */
export async function getScoreDistribution(
  contestId: string,
  params?: {
    buckets?: number;
  }
): Promise<ApiResponse> {
  return get(`/analytics/${contestId}/score-distribution`, { params });
}

/**
 * POST /analytics/:contestId/refresh
 * Force refresh snapshot
 */
export async function refreshAnalytics(contestId: string): Promise<ApiResponse> {
  return post(`/analytics/${contestId}/refresh`);
}
