'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSubmissions, invalidateSubmission } from '../api/submissions.api';
import { toast } from 'sonner';

export function useSubmissions(contestId: string, filters?: { status?: string; page?: number; limit?: number }) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['submissions', contestId, filters],
    queryFn: () => listSubmissions(contestId, filters),
    enabled: !!contestId,
  });

  const invalidateMutation = useMutation({
    mutationFn: ({ submissionId, reason }: { submissionId: string; reason: string }) =>
      invalidateSubmission(submissionId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions', contestId] });
      toast.success('Submission invalidated successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to invalidate submission');
    },
  });

  return {
    submissions: data?.data?.data || [],
    pagination: data?.data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 },
    summary: data?.data?.summary || null,
    loading: isLoading,
    error,
    invalidateSubmission: invalidateMutation.mutateAsync,
    isInvalidating: invalidateMutation.isPending,
  };
}
