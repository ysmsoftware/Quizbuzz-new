'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { submissionsApi } from '@/lib/api/post-quiz.api';
import { toast } from 'sonner';

/**
 * Hook to fetch paginated submissions for a specific contest
 */
export function useContestSubmissions(
  contestId: string,
  filters: { status?: string; page?: number; limit?: number } = {}
) {
  const { status, page, limit = 20 } = filters;
  
  return useQuery({
    queryKey: ['submissions', contestId, { status, page, limit }],
    queryFn: () => submissionsApi.getContestSubmissions(contestId, { 
      status: status === 'all' || !status ? undefined : status, 
      page, 
      limit 
    }),
    enabled: !!contestId,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });
}

/**
 * Hook to fetch submissions statistics for a specific contest
 */
export function useContestSubmissionsStats(contestId: string) {
  return useQuery({
    queryKey: ['submissionsStats', contestId],
    queryFn: () => submissionsApi.getContestSubmissionsStats(contestId),
    enabled: !!contestId,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });
}

/**
 * Hook to fetch detailed submission record with question details & answer breakdowns
 */
export function useSubmissionDetail(submissionId: string | null) {
  return useQuery({
    queryKey: ['submissionDetail', submissionId],
    queryFn: () => {
      if (!submissionId) throw new Error('Submission ID is required');
      return submissionsApi.getSubmissionDetail(submissionId);
    },
    enabled: !!submissionId,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });
}

/**
 * Hook to invalidate a submission
 */
export function useInvalidateSubmission(contestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submissionId, reason }: { submissionId: string; reason: string }) =>
      submissionsApi.invalidateSubmission(submissionId, reason),
    onSuccess: (_, variables) => {
      toast.success('Submission invalidated successfully');
      queryClient.invalidateQueries({ queryKey: ['submissions', contestId] });
      queryClient.invalidateQueries({ queryKey: ['submissionsStats', contestId] });
      queryClient.invalidateQueries({ queryKey: ['submissionDetail', variables.submissionId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to invalidate submission');
    },
  });
}

/**
 * Hook to trigger bulk evaluation of submissions for a contest
 */
export function useBulkEvaluateSubmissions(contestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => submissionsApi.bulkEvaluate(contestId),
    onSuccess: () => {
      toast.success('Submissions re-evaluation triggered successfully');
      queryClient.invalidateQueries({ queryKey: ['submissions', contestId] });
      queryClient.invalidateQueries({ queryKey: ['submissionsStats', contestId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to trigger re-evaluation');
    },
  });
}
