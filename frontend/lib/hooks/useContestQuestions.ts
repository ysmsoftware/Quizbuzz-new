'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import * as questionsApi from '../api/questions.api';
import * as contestsApi from '../api/contests.api';
import { queryKeys } from '../api/queryClient';

/**
 * Contest questions hook using TanStack Query
 * 
 * Manages questions assigned to a specific contest.
 */
export function useContestQuestions(contestId: string) {
  const queryClient = useQueryClient();

  /**
   * Get questions assigned to this contest
   */
  const questionsQuery = useQuery({
    queryKey: queryKeys.questions.contestQuestions(contestId),
    queryFn: () => questionsApi.getContestQuestions(contestId),
    enabled: !!contestId,
  });

  /**
   * Assign questions to contest
   */
  const assignMutation = useMutation({
    mutationFn: (questions: any[]) => questionsApi.assignQuestionsToContest(contestId, questions),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.questions.contestQuestions(contestId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
    },
  });

  /**
   * Update question config (marks, negativeMark)
   */
  const updateConfigMutation = useMutation({
    mutationFn: ({
      questionId,
      marks,
      negativeMark,
    }: {
      questionId: string;
      marks?: number;
      negativeMark?: number;
    }) => questionsApi.updateContestQuestion(contestId, questionId, { marks, negativeMark }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.questions.contestQuestions(contestId),
      });
    },
  });

  /**
   * Remove question from contest
   */
  const removeMutation = useMutation({
    mutationFn: (questionId: string) => questionsApi.removeContestQuestion(contestId, questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.questions.contestQuestions(contestId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
      toast.success('Question removed from contest');
    },
  });

  /**
   * Duplicate question logic
   */
  const duplicateMutation = useMutation({
    mutationFn: async (question: any) => {
      const { id, ...rest } = question;
      return questionsApi.createQuestion({
        ...rest,
        text: `${rest.text} (Copy)`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.questions.contestQuestions(contestId),
      });
      toast.success('Question duplicated');
    },
  });

  /**
   * Bulk update difficulty
   */
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[], updates: any }) => {
      // If API supports bulk update, use it. Otherwise loop.
      // Assuming individual updates for now as per api definition
      return Promise.all(ids.map(id => questionsApi.updateQuestion(id, updates)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.questions.contestQuestions(contestId),
      });
      toast.success('Questions updated successfully');
    },
  });

  // Extract data
  const questions = (questionsQuery.data?.data as any[]) || [];
  const isLoading = questionsQuery.isLoading;

  return {
    // Derived state
    data: questions,
    isLoading,
    
    // Mutations/Methods
    deleteQuestion: (id: string) => removeMutation.mutateAsync(id),
    duplicateQuestion: (q: any) => duplicateMutation.mutateAsync(q),
    bulkUpdateQuestions: (args: { ids: string[], updates: any }) => bulkUpdateMutation.mutateAsync(args),
    
    // Original mutations if needed
    assignMutation,
    updateConfigMutation,
  };
}
