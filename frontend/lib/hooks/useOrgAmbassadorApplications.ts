'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ambassadorCampaignApi, type ApplicationsFilters } from '@/lib/api/ambassador-campaign.api';

export function useOrgAmbassadorApplications(filters: ApplicationsFilters = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['org-ambassador-applications', filters],
    queryFn: () => ambassadorCampaignApi.getApplications(filters),
    placeholderData: keepPreviousData,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => ambassadorCampaignApi.approveApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-ambassador-applications'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      ambassadorCampaignApi.rejectApplication(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-ambassador-applications'] });
    },
  });

  return {
    applications: query.data?.data?.data ?? [],
    pagination: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    approve: approveMutation.mutateAsync,
    approveLoading: approveMutation.isPending,
    reject: rejectMutation.mutateAsync,
    rejectLoading: rejectMutation.isPending,
  };
}

export function useOrgAmbassadorApplication(id: string) {
  const query = useQuery({
    queryKey: ['org-ambassador-application', id],
    queryFn: () => ambassadorCampaignApi.getApplication(id),
    enabled: !!id,
  });

  return {
    application: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
