'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ambassadorCampaignApi, type CampaignsFilters } from '@/lib/api/ambassador-campaign.api';
import type { RewardConfig, ShareTemplates } from '@/lib/types/ambassador';

export function useOrgAmbassadorCampaigns(filters: CampaignsFilters = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['org-ambassador-campaigns', filters],
    queryFn: () => ambassadorCampaignApi.getCampaigns(filters),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      contestId: string;
      name: string;
      ambassadorTypesAllowed: string[];
      rewardConfig: RewardConfig;
      shareTemplates: ShareTemplates;
    }) => ambassadorCampaignApi.createCampaign(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-ambassador-campaigns'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: ({ id, contestId }: { id: string; contestId: string }) =>
      ambassadorCampaignApi.duplicateCampaign(id, contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-ambassador-campaigns'] });
    },
  });

  return {
    campaigns: query.data?.data?.data ?? [],
    pagination: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    createCampaign: createMutation.mutateAsync,
    createCampaignLoading: createMutation.isPending,
    createCampaignError: createMutation.error as Error | null,
    duplicateCampaign: duplicateMutation.mutateAsync,
    duplicateCampaignLoading: duplicateMutation.isPending,
  };
}

export function useOrgAmbassadorCampaign(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['org-ambassador-campaign', id],
    queryFn: () => ambassadorCampaignApi.getCampaign(id),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof ambassadorCampaignApi.updateCampaign>[1]) =>
      ambassadorCampaignApi.updateCampaign(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-ambassador-campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['org-ambassador-campaigns'] });
    },
  });

  return {
    campaign: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    updateCampaign: updateMutation.mutateAsync,
    updateCampaignLoading: updateMutation.isPending,
    updateCampaignError: updateMutation.error as Error | null,
  };
}
