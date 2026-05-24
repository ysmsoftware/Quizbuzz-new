'use client';

import { useQuery } from '@tanstack/react-query';
import { crmApi } from '@/lib/api/crm.api';

export function useMessageDetail(messageId: string | null) {
  return useQuery({
    queryKey: ['message', messageId],
    queryFn: () => crmApi.getMessageDetail(messageId!),
    enabled: !!messageId,
    staleTime: 1000 * 60 * 2,
  });
}
