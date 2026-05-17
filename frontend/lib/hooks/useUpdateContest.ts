'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as contestsApi from '../api/contests.api';
import { queryKeys } from '../api/queryClient';

/**
 * Update contest hook
 */
export function useUpdateContest(contestId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: any) => contestsApi.updateContest(contestId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.list({}) });
    },
  });

  return mutation;
}
