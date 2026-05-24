import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import * as analyticsApi from '@/lib/api/analytics.api';

export function useContestAnalytics(contestId: string) {
  const { data: snapshot, isLoading: isSnapshotLoading, refetch: refetchSnapshot } = useQuery({
    queryKey: ['contest-analytics', contestId],
    queryFn: () => analyticsApi.getContestAnalytics(contestId),
    enabled: !!contestId,
  });

  const { data: live, isLoading: isLiveLoading } = useQuery({
    queryKey: ['live-analytics', contestId],
    queryFn: () => analyticsApi.getLiveAnalytics(contestId),
    enabled: !!contestId,
    refetchInterval: 30000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => analyticsApi.refreshAnalytics(contestId),
  });

  return {
    snapshot: snapshot?.data as any,
    live: live?.data as any,
    loading: isSnapshotLoading || isLiveLoading,
    refreshSnapshot: async () => {
      await refreshMutation.mutateAsync();
      await refetchSnapshot();
    },
    isRefreshing: refreshMutation.isPending,
  };
}
