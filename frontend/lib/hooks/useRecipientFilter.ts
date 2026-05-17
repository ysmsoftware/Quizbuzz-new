import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { messageService } from '@/lib/services/message-service';
import type { RecipientFilter } from '@/lib/types';

export function useRecipientFilter(contestId: string) {
  const [filter, setFilter] = useState<RecipientFilter>('all');

  const query = useQuery({
    queryKey: ['recipient-count', contestId, filter],
    queryFn: () => messageService.calculateRecipientCount(contestId, filter),
    enabled: !!contestId,
  });

  return {
    filter,
    setFilter,
    count: query.data ?? 0,
    loading: query.isLoading,
  };
}
