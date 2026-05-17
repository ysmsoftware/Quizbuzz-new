'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getProctoringOverview, 
  listFlaggedParticipants, 
  listProctoringEvents, 
  getParticipantProctoringDetail,
  reviewViolations
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

  // Get flagged participants
  const { data: flagged, isLoading: loadingFlagged } = useQuery({
    queryKey: ['proctoring-flagged', contestId],
    queryFn: () => listFlaggedParticipants(contestId),
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
