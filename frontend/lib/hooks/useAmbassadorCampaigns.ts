'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';

export function useAvailableCampaigns(params: { page?: number; limit?: number } = {}) {
  const query = useQuery({
    queryKey: ['ambassador-campaigns', 'available', params],
    queryFn: () => ambassadorService.getAvailableCampaigns(params),
    staleTime: 1000 * 60,
  });

  return {
    campaigns: query.data?.data ?? [],
    pagination: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useMyCampaigns(params: { page?: number; limit?: number } = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ambassador-campaigns', 'mine', params],
    queryFn: () => ambassadorService.getMyCampaigns(params),
    staleTime: 1000 * 30,
  });

  const joinMutation = useMutation({
    mutationFn: (campaignId: string) => ambassadorService.joinCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-campaigns'] });
    },
  });

  return {
    campaigns: query.data?.data ?? [],
    pagination: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    join: joinMutation.mutateAsync,
    joinLoading: joinMutation.isPending,
  };
}

/**
 * Finds a single joined campaign's list-level fields (name, contestTitle, referralCode)
 * by id — GET /ambassador/campaigns/:id/stats doesn't return these, only live numbers,
 * so the campaign detail page pairs this with useAmbassadorCampaignStats for the full picture.
 */
export function useJoinedCampaign(campaignId: string) {
  const { campaigns, isLoading, isError } = useMyCampaigns({ limit: 100 });
  return {
    campaign: campaigns.find((c) => c.campaignId === campaignId),
    isLoading,
    isError,
  };
}
