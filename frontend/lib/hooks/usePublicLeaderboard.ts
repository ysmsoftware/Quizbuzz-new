'use client';

import { useQuery } from '@tanstack/react-query';
import { resultsApi } from '@/lib/api/results-certs.api';

export function usePublicLeaderboard(contestId: string, page = 1) {
  const leaderboardQuery = useQuery({
    queryKey: ['public-leaderboard', contestId, page],
    queryFn: () => resultsApi.getPublicLeaderboard(contestId, { page, limit: 50 }),
    enabled: !!contestId,
    retry: false,
  });

  return {
    leaderboard: leaderboardQuery.data?.data,
    entries: leaderboardQuery.data?.data?.entries ?? [],
    isLoading: leaderboardQuery.isLoading,
    error: leaderboardQuery.error,
    refetch: leaderboardQuery.refetch,
  };
}
