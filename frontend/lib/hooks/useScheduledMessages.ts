import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageService } from '@/lib/services/message-service';
import type { MessageDraft } from '@/lib/types';

export function useScheduledMessages(contestId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['scheduled-messages', contestId],
    queryFn: () => messageService.getScheduledMessages(contestId),
    enabled: !!contestId,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => messageService.cancelScheduled(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages', contestId] });
    },
  });

  return {
    messages: query.data?.data ?? ([] as MessageDraft[]),
    loading: query.isLoading,
    cancelScheduled: cancelMutation.mutateAsync,
  };
}
