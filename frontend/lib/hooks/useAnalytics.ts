import { useQuery } from '@tanstack/react-query';
import * as analyticsApi from '@/lib/api/analytics.api';

export function useContestAnalytics(contestId: string) {
  const { data: snapshot, isLoading: isSnapshotLoading } = useQuery({
    queryKey: ['contest-analytics', contestId],
    queryFn: () => analyticsApi.getContestAnalytics(contestId),
    enabled: !!contestId,
  });

  const { data: live, isLoading: isLiveLoading } = useQuery({
    queryKey: ['live-analytics', contestId],
    queryFn: () => analyticsApi.getLiveAnalytics(contestId),
    enabled: !!contestId,
    refetchInterval: 30000, // Refresh every 30 seconds for live data
  });

  return {
    snapshot,
    live,
    loading: isSnapshotLoading || isLiveLoading,
  };
}
