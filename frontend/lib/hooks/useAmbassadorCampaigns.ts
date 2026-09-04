'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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

  const applyMutation = useMutation({
    mutationFn: (campaignId: string) => ambassadorService.applyToCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador-campaigns'] });
    },
  });

  return {
    campaigns: query.data?.data ?? [],
    pagination: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    apply: applyMutation.mutateAsync,
    applyLoading: applyMutation.isPending,
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

/**
 * Finds one available (not-yet-applied-to) campaign's public preview slice by id. There's no
 * single-campaign ambassador endpoint for this, so — same trick as useJoinedCampaign above —
 * it reuses the "available" list the campaigns page already fetches and finds by id.
 */
export function useAvailableCampaign(campaignId: string) {
  const { campaigns, isLoading, isError } = useAvailableCampaigns({ limit: 100 });
  return {
    campaign: campaigns.find((c) => c.id === campaignId),
    isLoading,
    isError,
  };
}

/** Every LIVE campaign across every organization — no ambassador session required. Backs the
 *  "campaigns accepting applications" section on the /ambassador landing page. */
export function usePublicCampaigns(params: { page?: number; limit?: number } = {}) {
  const query = useQuery({
    queryKey: ['ambassador-campaigns', 'public', params],
    queryFn: () => ambassadorService.listPublicCampaigns(params),
    staleTime: 1000 * 60,
  });

  return {
    campaigns: query.data?.data ?? [],
    pagination: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/** Name-only list of who this ambassador's referral link brought in — the admin equivalent
 *  (full contact detail) is useOrgAmbassadorReferrals. `enabled` defaults to true but lets a
 *  caller that only shows this list inside an on-demand drawer skip the fetch until it's
 *  actually opened, instead of loading a page of referrals nobody may ever look at. */
export function useMyReferrals(campaignId: string, page: number, enabled = true) {
  const query = useQuery({
    queryKey: ['ambassador-my-referrals', campaignId, page],
    queryFn: () => ambassadorService.getMyReferrals(campaignId, { page, limit: 20 }),
    enabled: !!campaignId && enabled,
    placeholderData: keepPreviousData,
  });

  return {
    referrals: query.data?.data ?? [],
    pagination: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/** Unauthenticated campaign preview, for the public shareable-link page — no ambassador
 *  session required, unlike every other hook in this file. */
export function usePublicCampaignPreview(campaignId: string) {
  const query = useQuery({
    queryKey: ['ambassador-campaign-public-preview', campaignId],
    queryFn: () => ambassadorService.getPublicCampaignPreview(campaignId),
    enabled: !!campaignId,
    staleTime: 1000 * 60,
    retry: false,
  });

  return {
    campaign: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
