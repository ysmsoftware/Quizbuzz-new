'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api/apiClient';
import { ambassadorCampaignApi } from '@/lib/api/ambassador-campaign.api';

/**
 * There's no dedicated "is the ambassador program enabled" endpoint — the API
 * spec's own posture is that every /org/ambassadors* route 404s (not 403) when
 * the org's `ambassador_program_enabled` flag is off, and the frontend should
 * treat that 404 the same as "feature not available". This probes the
 * cheapest such route (campaigns, limit 1) purely to read that signal.
 *
 * Shared by two consumers, deduped by React Query on the same query key:
 * the org sidebar (hides the "Ambassadors" nav item while off) and
 * app/org/ambassadors/layout.tsx (blocks direct URL navigation into the
 * section while off) — one probe, not two.
 */
export function useAmbassadorProgramEnabled(orgId: string): { enabled: boolean; isLoading: boolean } {
  const query = useQuery({
    queryKey: ['ambassador-program-enabled', orgId],
    queryFn: async () => {
      try {
        await ambassadorCampaignApi.getCampaigns({ limit: 1 });
        return true;
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) return false;
        throw err;
      }
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  return { enabled: query.data ?? false, isLoading: !!orgId && query.isLoading };
}
