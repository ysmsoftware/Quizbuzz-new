'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as contestsApi from '../api/contests.api';
import { queryKeys } from '../api/queryClient';

/**
 * Mutations for the contest lifecycle operations (reschedule / cancel / force-end).
 *
 * These are deliberately separate from useUpdateContest: they are distinct server
 * operations with their own status rules and their own participant-notification
 * behaviour, not field updates.
 */

/** Shared cache invalidation — every lifecycle op changes contest status or timing. */
function useLifecycleInvalidation(contestId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.contests.list({}) });
  };
}

export function useRescheduleContest(contestId: string) {
  const invalidate = useLifecycleInvalidation(contestId);

  return useMutation({
    mutationFn: (body: {
      startTime: string;
      registrationDeadline?: string;
      duration?: number;
      reason?: string;
      notifyParticipants?: boolean;
    }) => contestsApi.rescheduleContest(contestId, body),
    onSuccess: invalidate,
  });
}

export function useCancelContest(contestId: string) {
  const invalidate = useLifecycleInvalidation(contestId);

  return useMutation({
    mutationFn: (body: { reason: string; notifyParticipants?: boolean }) =>
      contestsApi.cancelContest(contestId, body),
    onSuccess: invalidate,
  });
}

export function useForceEndContest(contestId: string) {
  const invalidate = useLifecycleInvalidation(contestId);

  return useMutation({
    mutationFn: (body?: { reason?: string }) => contestsApi.forceEndContest(contestId, body),
    onSuccess: invalidate,
  });
}

export function useStartContestNow(contestId: string) {
  const invalidate = useLifecycleInvalidation(contestId);

  return useMutation({
    mutationFn: (body?: { reason?: string }) => contestsApi.startContestNow(contestId, body),
    onSuccess: invalidate,
  });
}
