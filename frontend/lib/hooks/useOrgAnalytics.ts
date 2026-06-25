import { useQuery } from '@tanstack/react-query';
import { analyticsService, type OrgAnalytics } from '@/lib/services/analytics-service';

const EMPTY_ANALYTICS: OrgAnalytics = {
  dailyMetrics: [],
  totalRegistrations: 0,
  totalRevenue: 0,
  avgDailyRegistrations: 0,
  contestsByStatus: {
    live: 0,
    upcoming: 0,
    ended: 0,
    draft: 0,
  },
  topContests: [],
};

export function useOrgAnalytics(
  orgId: string,
  dateRange: { from: string; to: string } = {
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  }
) {
  const { data, isLoading } = useQuery({
    queryKey: ['org-analytics', orgId, dateRange],
    queryFn: () => analyticsService.getOrgAnalytics(orgId, dateRange),
    enabled: !!orgId,
  });

  const exportCSV = () => {
    console.log('Exporting CSV...');
  };

  return {
    analytics: data ?? EMPTY_ANALYTICS,
    loading: isLoading,
    exportCSV,
  };
}
