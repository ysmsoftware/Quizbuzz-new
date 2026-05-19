'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import * as contestsApi from '../api/contests.api';
import { queryKeys } from '../api/queryClient';

/**
 * Leaderboard hook using TanStack Query
 * Public endpoint — no admin auth required
 */
export function useLeaderboard(contestId: string, page: number = 1) {
  /**
   * Get leaderboard query
   */
  const leaderboardQuery = useQuery({
    queryKey: queryKeys.contests.leaderboard(contestId, page),
    queryFn: () => contestsApi.getLeaderboard(contestId, { page }),
    enabled: !!contestId,
  });

  // Extract data
  const leaderboardData = leaderboardQuery.data?.data as any;
  const entries = leaderboardData?.entries || [];
  const pagination = leaderboardData?.pagination;
  const isLoading = leaderboardQuery.isLoading;

  // Helper functions
  const getTopN = useCallback(
    (n: number = 10) => {
      return entries.slice(0, n);
    },
    [entries]
  );

  const getPodium = useCallback(() => {
    return entries.slice(0, 3);
  }, [entries]);

  const getScorePercentiles = useCallback(() => {
    if (entries.length === 0) return {};
    const sorted = [...entries].sort((a, b) => b.score - a.score);
    const p25 = Math.floor(sorted.length * 0.25);
    const p50 = Math.floor(sorted.length * 0.5);
    const p75 = Math.floor(sorted.length * 0.75);
    return {
      p25: sorted[p25]?.score || 0,
      p50: sorted[p50]?.score || 0,
      p75: sorted[p75]?.score || 0,
    };
  }, [entries]);

  const getParticipantRank = useCallback(
    (participantId: string) => {
      const entry = entries.find((e: any) => e.participantId === participantId);
      return entry?.rank ?? null;
    },
    [entries]
  );

  const getParticipantScore = useCallback(
    (participantId: string) => {
      const entry = entries.find((e: any) => e.participantId === participantId);
      return entry?.score ?? null;
    },
    [entries]
  );

  return {
    // Query objects
    leaderboardQuery,

    // Derived state
    entries,
    pagination,
    isLoading,

    // Helper functions
    getTopN,
    getPodium,
    getScorePercentiles,
    getParticipantRank,
    getParticipantScore,
    refetch: leaderboardQuery.refetch,

    // Backward-compatible
    leaderboard: entries,
    loading: isLoading,
    error: leaderboardQuery.error?.message ?? null,
    lastUpdated: leaderboardQuery.dataUpdatedAt ? new Date(leaderboardQuery.dataUpdatedAt) : null,
  };
}
