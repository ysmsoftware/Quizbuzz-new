'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ambassadorCampaignApi, type OrgAmbassadorsFilters } from '@/lib/api/ambassador-campaign.api';

/**
 * The org-wide ambassador directory — one row per distinct APPROVED person, deduped across
 * however many of this org's campaigns they've joined. Distinct from the Applications
 * queue (useAmbassadorApplications-style hooks), which is the per-campaign review list
 * (any status, one row per enrollment) — this is "who's actually part of our program."
 */
export function useOrgAmbassadors(filters: OrgAmbassadorsFilters = {}) {
  const query = useQuery({
    queryKey: ['org-ambassadors', filters],
    queryFn: () => ambassadorCampaignApi.getOrgAmbassadors(filters),
    placeholderData: keepPreviousData,
  });

  return {
    ambassadors: query.data?.data?.data ?? [],
    pagination: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useOrgAmbassador(ambassadorId: string | null) {
  const query = useQuery({
    queryKey: ['org-ambassador', ambassadorId],
    queryFn: () => ambassadorCampaignApi.getOrgAmbassador(ambassadorId as string),
    enabled: !!ambassadorId,
  });

  return {
    ambassador: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
