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

  // Extract and map data to match expected frontend interface
  const questions = ((questionsQuery.data?.data as any[]) || []).map((q: any) => ({
    id: q.question?.id || q.questionId,
    contestQuestionId: q.id,
    text: q.question?.questionText || '',
    difficulty: (q.question?.difficulty || 'MEDIUM').toLowerCase(),
    options: q.question?.options || [],
    hint: q.question?.hint || '',
    explanation: q.question?.explanation || '',
    tags: q.question?.tags || [],
    marks: Number(q.marks) ?? 4,
    // negativeMark comes from Prisma as a Decimal serialised to a string ("1.00").
    // Number() converts it correctly. Fall back to 0 (no deduction) if absent.
    negativeMark: q.negativeMark !== null && q.negativeMark !== undefined
      ? Number(q.negativeMark)
      : 0,
    position: q.position ?? 0,
  }));
  const isLoading = questionsQuery.isLoading;

  /**
   * Duplicate question logic
   */
  const duplicateMutation = useMutation({
    mutationFn: async (question: any) => {
      // 1. Create the new question
      const createRes = await questionsApi.createQuestion({
        questionText: `${question.text} (Copy)`,
        difficulty: question.difficulty.toUpperCase(),
        tags: question.tags || [],
        hint: question.hint || undefined,
        explanation: question.explanation || undefined,
        options: question.options.map((o: any, idx: number) => ({
          text: o.text,
          isCorrect: o.isCorrect,
          position: idx,
        })),
      });

      const newQuestionId = createRes.data?.id;
      if (!newQuestionId) {
        throw new Error('Failed to create duplicated question');
      }

      // 2. Assign to contest
      await questionsApi.assignQuestionsToContest(contestId, [{
        questionId: newQuestionId,
        position: questions.length + 1, // Put at the end (1-based to satisfy positive check)
        marks: question.marks,
        negativeMark: question.negativeMark,
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.questions.contestQuestions(contestId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
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

  /**
   * Create question globally and assign to contest
   */
  const createAndAssignMutation = useMutation({
    mutationFn: async (data: {
      questionText: string;
      difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      tags: string[];
      hint?: string;
      explanation?: string;
      options: Array<{ text: string; isCorrect: boolean }>;
      marks: number;
      negativeMark?: number;
    }) => {
      const { marks, negativeMark, ...questionData } = data;
      
      // 1. Create the question
      const createRes = await questionsApi.createQuestion({
        ...questionData,
        options: questionData.options.map((o, idx) => ({
          ...o,
          position: idx,
        })),
      });

      const newQuestionId = createRes.data?.id;
      if (!newQuestionId) {
        throw new Error('Failed to create question');
      }

      // 2. Assign to contest
      return questionsApi.assignQuestionsToContest(contestId, [{
        questionId: newQuestionId,
        position: questions.length + 1, // 1-based indexing for positive constraint
        marks,
        negativeMark,
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.questions.contestQuestions(contestId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
      toast.success('Question created and assigned to contest');
    },
  });

  /**
   * Update question globally and its contest config
   */
  const updateContestQuestionMutation = useMutation({
    mutationFn: async (data: {
      questionId: string;
      contestQuestionId: string;
      questionText: string;
      difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      tags: string[];
      hint?: string;
      explanation?: string;
      options: Array<{ text: string; isCorrect: boolean }>;
      marks: number;
      negativeMark?: number;
    }) => {
      const { questionId, contestQuestionId, marks, negativeMark, ...questionData } = data;

      // 1. Update the question in global pool
      await questionsApi.updateQuestion(questionId, {
        ...questionData,
        options: questionData.options.map((o, idx) => ({
          ...o,
          position: idx,
        })),
      });

      // 2. Update contest specific marks and negative marks
      return questionsApi.updateContestQuestion(contestId, questionId, {
        marks,
        negativeMark,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.questions.contestQuestions(contestId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
      toast.success('Question updated successfully');
    },
  });

  return {
    // Derived state
    data: questions,
    isLoading,
    
    // Mutations/Methods
    deleteQuestion: (id: string) => removeMutation.mutateAsync(id),
    duplicateQuestion: (q: any) => duplicateMutation.mutateAsync(q),
    bulkUpdateQuestions: (args: { ids: string[], updates: any }) => bulkUpdateMutation.mutateAsync(args),
    createAndAssignQuestion: (data: any) => createAndAssignMutation.mutateAsync(data),
    updateContestQuestion: (data: any) => updateContestQuestionMutation.mutateAsync(data),
    
    // Original mutations if needed
    assignMutation,
    updateConfigMutation,
  };
}
