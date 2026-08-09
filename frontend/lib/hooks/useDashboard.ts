'use client';

import { useQuery } from '@tanstack/react-query';
import * as dashboardApi from '../api/dashboard.api';
import { queryKeys } from '../api/queryClient';

/**
 * Auto-refresh cadence for the org dashboard. Two tiers so the "fast-moving"
 * widgets (live counts, newest signups) feel closer to real-time than the
 * heavier/less time-sensitive ones (trend chart, status breakdown) — both are
 * still well within the 5-10s window that was asked for.
 */
const FAST_REFETCH_MS = 7_000;
const SLOW_REFETCH_MS = 10_000;

/**
 * Each widget below is its own independent useQuery: one endpoint failing or
 * lagging never blocks or clears the others, and each re-renders only itself
 * on refetch instead of the whole dashboard.
 */

export function useDashboardOverview(orgId: string, period: 'week' | 'month' = 'month') {
  return useQuery({
    queryKey: queryKeys.dashboard.overview(orgId, { period }),
    queryFn: () => dashboardApi.getDashboardOverview(orgId, { period }),
    enabled: !!orgId,
    refetchInterval: FAST_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}

export function useUpcomingContests(
  orgId: string,
  params?: {
    limit?: number;
    status?: dashboardApi.ContestStatus | dashboardApi.ContestStatus[];
    sortBy?: 'startTime' | 'registrationDeadline' | 'createdAt';
    sortOrder?: dashboardApi.SortOrder;
  }
) {
  return useQuery({
    queryKey: queryKeys.dashboard.upcomingContests(orgId, params),
    queryFn: () => dashboardApi.getUpcomingContests(orgId, params),
    enabled: !!orgId,
    refetchInterval: FAST_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}

export function useRecentRegistrations(
  orgId: string,
  params?: {
    limit?: number;
    page?: number;
    sortBy?: 'createdAt' | 'status';
    sortOrder?: dashboardApi.SortOrder;
    contestId?: string;
    status?: dashboardApi.ParticipantStatus;
  }
) {
  return useQuery({
    queryKey: queryKeys.dashboard.recentRegistrations(orgId, params),
    queryFn: () => dashboardApi.getRecentRegistrations(orgId, params),
    enabled: !!orgId,
    refetchInterval: FAST_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}

export function useRegistrationTrend(orgId: string, days: number = 7) {
  return useQuery({
    queryKey: queryKeys.dashboard.registrationTrend(orgId, { days }),
    queryFn: () => dashboardApi.getRegistrationTrend(orgId, { days }),
    enabled: !!orgId,
    refetchInterval: SLOW_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}

export function useContestsByStatus(orgId: string, includeArchived: boolean = false) {
  return useQuery({
    queryKey: queryKeys.dashboard.contestsByStatus(orgId, { includeArchived }),
    queryFn: () => dashboardApi.getContestsByStatus(orgId, { includeArchived }),
    enabled: !!orgId,
    refetchInterval: SLOW_REFETCH_MS,
    refetchOnWindowFocus: true,
  });
}
