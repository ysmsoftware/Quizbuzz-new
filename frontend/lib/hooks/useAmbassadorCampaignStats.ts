'use client';

import { useQuery } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';
import type { LeaderboardScope } from '@/lib/types/ambassador';

export function useAmbassadorCampaignStats(campaignId: string) {
  const query = useQuery({
    queryKey: ['ambassador-campaign-stats', campaignId],
    queryFn: () => ambassadorService.getCampaignStats(campaignId),
    enabled: !!campaignId,
    staleTime: 1000 * 30,
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/** Social proof for one campaign — "N ambassadors joined this week" + tier mix. Only
 *  meaningful for a campaign the ambassador is APPROVED on (same gate as stats). */
export function useAmbassadorCampaignSocialProof(campaignId: string) {
  const query = useQuery({
    queryKey: ['ambassador-campaign-social-proof', campaignId],
    queryFn: () => ambassadorService.getCampaignSocialProof(campaignId),
    enabled: !!campaignId,
    staleTime: 1000 * 60,
  });

  return {
    summary: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useAmbassadorCampaignLeaderboard(
  campaignId: string,
  scope: LeaderboardScope,
  params: { page?: number; limit?: number } = {}
) {
  const query = useQuery({
    queryKey: ['ambassador-campaign-leaderboard', campaignId, scope, params],
    queryFn: () => ambassadorService.getCampaignLeaderboard(campaignId, scope, params),
    enabled: !!campaignId && !!scope,
    staleTime: 1000 * 30,
  });

  return {
    rows: query.data?.data ?? [],
    pagination: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
