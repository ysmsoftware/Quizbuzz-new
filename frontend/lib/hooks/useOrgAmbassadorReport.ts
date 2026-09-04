'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ambassadorCampaignApi, type ReportFilters } from '@/lib/api/ambassador-campaign.api';

export function useOrgAmbassadorReport(campaignId: string, filters: ReportFilters = {}) {
  const query = useQuery({
    queryKey: ['org-ambassador-report', campaignId, filters],
    queryFn: () => ambassadorCampaignApi.getReport(campaignId, filters),
    enabled: !!campaignId,
    placeholderData: keepPreviousData,
  });

  return {
    rows: query.data?.data?.data ?? [],
    pagination: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
    exportUrl: ambassadorCampaignApi.getReportExportUrl(campaignId),
  };
}

/** Drill-down behind one report row's registrationCount — the individual registrations that
 *  ambassador's referral link brought in, full contact detail. `enrollmentId` null/undefined
 *  keeps the query disabled, so this is safe to call unconditionally with the currently-open
 *  row's id (or none). */
export function useOrgAmbassadorReferrals(campaignId: string, enrollmentId: string | null, page: number) {
  const query = useQuery({
    queryKey: ['org-ambassador-referrals', campaignId, enrollmentId, page],
    queryFn: () => ambassadorCampaignApi.getReferrals(campaignId, enrollmentId as string, { page, limit: 20 }),
    enabled: !!campaignId && !!enrollmentId,
    placeholderData: keepPreviousData,
  });

  return {
    rows: query.data?.data?.data ?? [],
    pagination: query.data?.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
