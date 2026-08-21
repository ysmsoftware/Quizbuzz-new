'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';

/** Cross-campaign daily registration trend — powers the dashboard's earnings sparkline
 *  (last 7 days) and its "vs last week" badge (computed client-side from 14 days of the
 *  same response, so the trend doesn't need its own endpoint). */
export function useAmbassadorActivity() {
  const query = useQuery({
    queryKey: ['ambassador-activity'],
    queryFn: () => ambassadorService.getMyActivity(14),
    staleTime: 1000 * 60,
  });

  const all = query.data?.dailyRegistrations ?? [];
  const dailyRegistrations = useMemo(() => all.slice(-7), [all]);

  const trendPercent = useMemo(() => {
    if (all.length < 14) return null;
    const thisWeek = all.slice(-7).reduce((sum, d) => sum + d.count, 0);
    const lastWeek = all.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);
    if (lastWeek === 0) return thisWeek > 0 ? 100 : null;
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  }, [all]);

  return {
    dailyRegistrations,
    trendPercent,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
