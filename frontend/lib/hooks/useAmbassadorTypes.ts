'use client';

import { useQuery } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';

/** Org-scoped — which ambassador types THIS org has enabled. Used by org-admin campaign
 *  config screens (the ambassadorTypesAllowed picker). For the platform-level signup
 *  flow's type picker, use usePlatformAmbassadorTypes below instead. */
export function useAmbassadorTypes(organizationId: string) {
  const query = useQuery({
    queryKey: ['ambassador-types', organizationId],
    queryFn: () => ambassadorService.getTypes(organizationId),
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
  });

  return {
    types: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/** Platform-wide — every active ambassador type, not scoped to any organization. Used at
 *  signup, before the person has any org relationship at all. */
export function usePlatformAmbassadorTypes() {
  const query = useQuery({
    queryKey: ['ambassador-types', 'platform'],
    queryFn: () => ambassadorService.getPlatformTypes(),
    staleTime: 1000 * 60 * 5,
  });

  return {
    types: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
