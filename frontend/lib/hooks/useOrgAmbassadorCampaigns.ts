'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ambassadorCampaignApi, type CampaignsFilters, type TemplatesFilters } from '@/lib/api/ambassador-campaign.api';
import type { AmbassadorGroupInput, CampaignPhaseTemplateEntry, DraftRewardConfig, ShareTemplates } from '@/lib/types/ambassador';

export function useOrgAmbassadorCampaigns(filters: CampaignsFilters = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['org-ambassador-campaigns', filters],
    queryFn: () => ambassadorCampaignApi.getCampaigns(filters),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      name: string;
      contestId?: string;
      ambassadorTypesAllowed?: string[];
      rewardConfig?: DraftRewardConfig;
      shareTemplates?: ShareTemplates;
      startDate?: string;
      endDate?: string;
      phaseTemplate?: CampaignPhaseTemplateEntry[] | null;
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

  const publishMutation = useMutation({
    mutationFn: () => ambassadorCampaignApi.publishCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-ambassador-campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['org-ambassador-campaigns'] });
    },
  });

  const invalidateCampaign = () => {
    queryClient.invalidateQueries({ queryKey: ['org-ambassador-campaign', id] });
    queryClient.invalidateQueries({ queryKey: ['org-ambassador-campaigns'] });
  };

  const activateMutation = useMutation({
    mutationFn: () => ambassadorCampaignApi.activateCampaign(id),
    onSuccess: invalidateCampaign,
  });

  const endMutation = useMutation({
    mutationFn: () => ambassadorCampaignApi.endCampaign(id),
    onSuccess: invalidateCampaign,
  });

  const archiveMutation = useMutation({
    mutationFn: () => ambassadorCampaignApi.archiveCampaign(id),
    onSuccess: invalidateCampaign,
  });

  return {
    campaign: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    updateCampaign: updateMutation.mutateAsync,
    updateCampaignLoading: updateMutation.isPending,
    updateCampaignError: updateMutation.error as Error | null,
    publishCampaign: publishMutation.mutateAsync,
    publishCampaignLoading: publishMutation.isPending,
    publishCampaignError: publishMutation.error as Error | null,
    activateCampaign: activateMutation.mutateAsync,
    activateCampaignLoading: activateMutation.isPending,
    endCampaign: endMutation.mutateAsync,
    endCampaignLoading: endMutation.isPending,
    archiveCampaign: archiveMutation.mutateAsync,
    archiveCampaignLoading: archiveMutation.isPending,
  };
}

export function useOrgAmbassadorCampaignGroups(campaignId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['org-ambassador-campaign-groups', campaignId],
    queryFn: () => ambassadorCampaignApi.getGroups(campaignId),
    enabled: !!campaignId,
  });

  const replaceMutation = useMutation({
    mutationFn: (groups: AmbassadorGroupInput[]) => ambassadorCampaignApi.replaceGroups(campaignId, groups),
    onSuccess: (res) => {
      queryClient.setQueryData(['org-ambassador-campaign-groups', campaignId], res);
    },
  });

  return {
    groups: query.data?.data?.groups ?? [],
    capacity: query.data?.data?.capacity,
    isLoading: query.isLoading,
    isError: query.isError,
    replaceGroups: replaceMutation.mutateAsync,
    replaceGroupsLoading: replaceMutation.isPending,
    replaceGroupsError: replaceMutation.error as Error | null,
  };
}

export function useOrgAmbassadorCampaignTemplates(filters: TemplatesFilters = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['org-ambassador-campaign-templates', filters],
    queryFn: () => ambassadorCampaignApi.getTemplates(filters),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['org-ambassador-campaign-templates'] });

  const createMutation = useMutation({
    mutationFn: (body: { sourceCampaignId: string; name: string }) => ambassadorCampaignApi.createTemplate(body),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ambassadorCampaignApi.deleteTemplate(id),
    onSuccess: invalidate,
  });

  const instantiateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body?: { contestId?: string; name?: string } }) =>
      ambassadorCampaignApi.instantiateTemplate(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-ambassador-campaigns'] });
    },
  });

  return {
    templates: query.data?.data?.data ?? [],
    pagination: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    createTemplate: createMutation.mutateAsync,
    createTemplateLoading: createMutation.isPending,
    deleteTemplate: deleteMutation.mutateAsync,
    deleteTemplateLoading: deleteMutation.isPending,
    instantiateTemplate: instantiateMutation.mutateAsync,
    instantiateTemplateLoading: instantiateMutation.isPending,
  };
}
