'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crmApi, MessageRecord } from '@/lib/api/crm.api';

export type ContestMessageFilters = {
  channel?: string;
  status?: string;
  template?: string;
  page?: number;
  limit?: number;
};

export function useContestMessages(contestId: string, filters: ContestMessageFilters = {}) {
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['contest-messages', contestId, filters],
    queryFn: () => crmApi.getContestMessages(contestId, filters),
    enabled: !!contestId,
    staleTime: 1000 * 60 * 2,
  });

  const retryMessageMutation = useMutation({
    mutationFn: (messageId: string) => crmApi.retryMessage(messageId),
    onSuccess: (_, messageId) => {
      queryClient.invalidateQueries({ queryKey: ['contest-messages', contestId] });
      queryClient.invalidateQueries({ queryKey: ['messages', contestId] });
    },
  });

  return {
    messagesQuery,
    messages: messagesQuery.data?.data?.data ?? ([] as MessageRecord[]),
    pagination: messagesQuery.data?.data?.pagination,
    summary: messagesQuery.data?.data?.summary,
    isLoading: messagesQuery.isLoading,
    retryMessage: retryMessageMutation.mutateAsync,
    isRetryingMessage: retryMessageMutation.isPending,
  };
}
