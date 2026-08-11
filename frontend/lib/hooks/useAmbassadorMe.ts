'use client';

import { useQuery } from '@tanstack/react-query';
import { ambassadorService } from '@/lib/services/ambassador-service';

export function useAmbassadorMe(options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: ['ambassador-me'],
    queryFn: () => ambassadorService.getMe(),
    enabled: options?.enabled ?? true,
    retry: false,
  });

  return {
    ambassador: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
