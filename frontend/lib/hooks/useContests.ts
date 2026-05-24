'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as contestsApi from '../api/contests.api';
import { queryKeys } from '../api/queryClient';

/**
 * Contests list hook using TanStack Query
 * 
 * For listing all contests with pagination and filters.
 */
export function useContests(filters?: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}) {
  const queryClient = useQueryClient();

  /**
   * List contests query
   */
  const contestsQuery = useQuery({
    queryKey: queryKeys.contests.list(filters),
    queryFn: () => contestsApi.listContests(filters),
  });

  /**
   * Create contest mutation
   */
  const createContestMutation = useMutation({
    mutationFn: (body: any) => contestsApi.createContest(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.list({}) });
    },
  });

  // Extract nested data structure
  const contests = contestsQuery.data?.data?.data;
  const pagination = contestsQuery.data?.data?.pagination;
  const isLoading = contestsQuery.isLoading;

  return {
    // Query objects
    contestsQuery,

    // Mutations
    createContestMutation,

    // Derived state
    contests,
    pagination,
    isLoading,
  };
}

/**
 * Archived Contests hook
 */
export function useArchivedContests(filters?: {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}) {
  const contestsQuery = useQuery({
    queryKey: ['archived-contests', filters],
    queryFn: () => contestsApi.listArchivedContests(filters),
  });

  const contests = contestsQuery.data?.data?.data;
  const pagination = contestsQuery.data?.data?.pagination;
  const isLoading = contestsQuery.isLoading;

  return {
    contestsQuery,
    contests,
    pagination,
    isLoading,
  };
}
