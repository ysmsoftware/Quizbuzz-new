import { useQuery } from '@tanstack/react-query';
import { messageService } from '@/lib/services/message-service';
import type { SentMessage } from '@/lib/types';

export function useSentMessages(contestId: string) {
  const query = useQuery({
    queryKey: ['sent-messages', contestId],
    queryFn: () => messageService.getSentMessages(contestId),
    enabled: !!contestId,
  });

  return {
    messages: query.data?.data ?? ([] as SentMessage[]),
    loading: query.isLoading,
  };
}
