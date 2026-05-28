'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getProctoringOverview, 
  listProctoringParticipants, 
  listProctoringEvents, 
  getParticipantProctoringDetail,
  reviewViolations,
  getParticipantCaptures,
} from '../api/proctoring.api';
import { toast } from 'sonner';

export function useProctoring(contestId: string) {
  const queryClient = useQueryClient();

  // Get overview stats
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['proctoring-overview', contestId],
    queryFn: () => getProctoringOverview(contestId),
    enabled: !!contestId,
  });

  // Get all participants for proctoring
  const { data: flagged, isLoading: loadingFlagged } = useQuery({
    queryKey: ['proctoring-flagged', contestId],
    queryFn: () => listProctoringParticipants(contestId, { isFlagged: undefined }),
    enabled: !!contestId,
  });

  // Mutation to review violations
  const reviewMutation = useMutation({
    mutationFn: ({ participantId, body }: { participantId: string; body: { dismiss: boolean; eventIds: string[]; note?: string } }) =>
      reviewViolations(contestId, participantId, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proctoring-overview', contestId] });
      queryClient.invalidateQueries({ queryKey: ['proctoring-flagged', contestId] });
      queryClient.invalidateQueries({ queryKey: ['proctoring-events', contestId] });
      queryClient.invalidateQueries({ queryKey: ['proctoring-detail', contestId, variables.participantId] });
      toast.success('Violations reviewed successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to review violations');
    },
  });

  return {
    overview: overview?.data || null,
    flaggedParticipants: flagged?.data?.data || [],
    loading: loadingOverview || loadingFlagged,
    reviewViolations: reviewMutation.mutateAsync,
    isReviewing: reviewMutation.isPending,
  };
}

export function useParticipantProctoring(contestId: string, participantId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['proctoring-detail', contestId, participantId],
    queryFn: () => getParticipantProctoringDetail(contestId, participantId),
    enabled: !!contestId && !!participantId,
  });

  return {
    detail: data?.data || null,
    loading: isLoading,
    error
  };
}

/**
 * Admin-only hook to fetch snapshot evidence captures for a participant.
 * Only fires when contestId and participantId are both provided.
 */
export function useParticipantCaptures(contestId: string, participantId: string | null | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['proctoring-captures', contestId, participantId],
    queryFn: () => getParticipantCaptures(contestId, participantId!),
    enabled: !!contestId && !!participantId,
    staleTime: 30_000, // presigned URLs valid for 1h, refresh every 30s is fine
  });

  return {
    captures: data?.data?.captures || [],
    loading: isLoading,
    error,
  };
}
