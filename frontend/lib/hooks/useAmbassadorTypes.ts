'use client';

import { useQuery } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';

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
