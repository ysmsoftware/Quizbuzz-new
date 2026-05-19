'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import * as contestsApi from '../api/contests.api';
import { queryKeys } from '../api/queryClient';
import { adaptServerContest } from '../utils/contest';

/**
 * Single contest detail hook using TanStack Query
 * 
 * Returns both query/mutation objects and backward-compatible surface
 * (contest, loading, error) for existing pages.
 */
export function useContest(contestId: string) {
  const queryClient = useQueryClient();

  /**
   * Contest detail query
   */
  const contestQuery = useQuery({
    queryKey: queryKeys.contests.detail(contestId),
    queryFn: () => contestsApi.getContest(contestId),
    enabled: !!contestId,
  });

  /**
   * Update contest mutation
   */
  const updateContestMutation = useMutation({
    mutationFn: (body: any) => contestsApi.updateContest(contestId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.list({}) });
    },
  });

  /**
   * Delete contest mutation
   */
  const deleteContestMutation = useMutation({
    mutationFn: () => contestsApi.deleteContest(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.list({}) });
      // Pages typically navigate away after delete
    },
  });

  /**
   * Publish contest mutation
   */
  const publishContestMutation = useMutation({
    mutationFn: () => contestsApi.publishContest(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
    },
  });

  /**
   * Evaluate contest mutation
   */
  const evaluateMutation = useMutation({
    mutationFn: () => contestsApi.triggerEvaluation(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
    },
  });

  /**
   * Declare results mutation
   */
  const declareResultsMutation = useMutation({
    mutationFn: () => contestsApi.declareResults(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
    },
  });

  // Backward-compatible surface / Adapted contest
  const serverContest = contestQuery.data?.data;
  const contest = serverContest ? adaptServerContest(serverContest) : undefined;
  const loading = contestQuery.isLoading;
  const error = contestQuery.error?.message ?? null;

  // Helper functions for time logic
  const isRegistrationOpen = useCallback(() => {
    if (!contest) return false;
    const now = new Date();
    const deadline = new Date(contest.registrationDeadline);
    return now < deadline;
  }, [contest]);

  const isContestActive = useCallback(() => {
    if (!contest) return false;
    const now = new Date();
    const startTime = new Date(contest.startTime);
    const endTime = new Date(startTime.getTime() + (contest.durationMinutes || 0) * 60000);
    return now >= startTime && now <= endTime;
  }, [contest]);

  const getTimeRemaining = useCallback(() => {
    if (!isContestActive() || !contest) return null;
    const startTime = new Date(contest.startTime);
    const endTime = new Date(startTime.getTime() + (contest.durationMinutes || 0) * 60000);
    const now = new Date();
    return Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
  }, [contest, isContestActive]);

  return {
    // Query objects (for advanced usage)
    contestQuery,

    // Mutations
    updateContestMutation,
    deleteContestMutation,
    publishContestMutation,
    evaluateMutation,
    declareResultsMutation,

    // Helper functions
    isRegistrationOpen,
    isContestActive,
    getTimeRemaining,

    // Backward-compatible surface
    contest,
    loading,
    error,
  };
}
