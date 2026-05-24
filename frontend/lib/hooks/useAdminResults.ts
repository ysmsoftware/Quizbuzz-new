'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resultsApi } from '@/lib/api/results-certs.api';

export function useAdminResults(contestId: string, page = 1) {
  const queryClient = useQueryClient();

  const leaderboardQuery = useQuery({
    queryKey: ['admin-leaderboard', contestId, page],
    queryFn: () => resultsApi.getPublicLeaderboard(contestId, { page, limit: 50 }),
    enabled: !!contestId,
  });

  const scoreDistributionQuery = useQuery({
    queryKey: ['admin-score-distribution', contestId],
    queryFn: () => resultsApi.getScoreDistribution(contestId),
    enabled: !!contestId,
  });

  const rebuildMutation = useMutation({
    mutationFn: () => resultsApi.triggerEvaluate(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leaderboard', contestId] });
    },
  });

  const declareResultsMutation = useMutation({
    mutationFn: () => resultsApi.declareResults(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-leaderboard', contestId] });
      queryClient.invalidateQueries({ queryKey: ['contests', contestId] });
      queryClient.invalidateQueries({ queryKey: ['contests', 'list'] });
    },
  });

  return {
    leaderboard: leaderboardQuery.data?.data,
    entries: leaderboardQuery.data?.data?.entries ?? [],
    scoreDistribution: scoreDistributionQuery.data?.data,
    isLoading: leaderboardQuery.isLoading || scoreDistributionQuery.isLoading,
    error: leaderboardQuery.error || scoreDistributionQuery.error,
    rebuildLeaderboard: rebuildMutation.mutateAsync,
    isRebuilding: rebuildMutation.isPending,
    declareResults: declareResultsMutation.mutateAsync,
    isDeclaringResults: declareResultsMutation.isPending,
  };
}
