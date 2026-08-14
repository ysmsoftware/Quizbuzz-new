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
