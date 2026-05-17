'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import * as contestsApi from '../api/contests.api';
import { queryKeys } from '../api/queryClient';

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

  // Helper functions for time logic
  const isRegistrationOpen = useCallback(() => {
    if (!contestQuery.data?.data) return false;
    const contest = contestQuery.data.data;
    const now = new Date();
    const deadline = new Date(contest.registrationDeadline);
    return now < deadline;
  }, [contestQuery.data]);

  const isContestActive = useCallback(() => {
    if (!contestQuery.data?.data) return false;
    const contest = contestQuery.data.data;
    const now = new Date();
    const startTime = new Date(contest.startTime);
    const endTime = new Date(contest.endTime);
    return now >= startTime && now <= endTime;
  }, [contestQuery.data]);

  const getTimeRemaining = useCallback(() => {
    if (!isContestActive()) return null;
    const contest = contestQuery.data?.data;
    if (!contest) return null;
    const endTime = new Date(contest.endTime);
    const now = new Date();
    return Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
  }, [contestQuery.data, isContestActive]);

  // Backward-compatible surface
  const contest = contestQuery.data?.data;
  const loading = contestQuery.isLoading;
  const error = contestQuery.error?.message ?? null;

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
