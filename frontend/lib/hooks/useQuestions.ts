'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as questionsApi from '../api/questions.api';
import { queryKeys } from '../api/queryClient';

/**
 * Questions list hook using TanStack Query
 */
export function useQuestions(filters?: {
  difficulty?: string;
  tags?: string | string[];
  search?: string;
  contestId?: string;
  unassignedFor?: string;
  page?: number;
  limit?: number;
}) {
  const queryClient = useQueryClient();

  /**
   * List questions query
   */
  const questionsQuery = useQuery({
    queryKey: queryKeys.questions.list(filters),
    queryFn: () => questionsApi.listQuestions(filters),
    placeholderData: (previousData) => previousData,
  });

  /**
   * Create question mutation
   */
  const createQuestionMutation = useMutation({
    mutationFn: (body: any) => questionsApi.createQuestion(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', 'list'] });
    },
  });

  /**
   * Bulk create mutation
   */
  const bulkCreateMutation = useMutation({
    mutationFn: (questions: any[]) => questionsApi.bulkCreateQuestions(questions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', 'list'] });
    },
  });

  /**
   * Update question mutation
   */
  const updateQuestionMutation = useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: any }) =>
      questionsApi.updateQuestion(questionId, body),
    onSuccess: (_, { questionId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.detail(questionId) });
      queryClient.invalidateQueries({ queryKey: ['questions', 'list'] });
    },
  });

  /**
   * Delete question mutation
   */
  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => questionsApi.deleteQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', 'list'] });
    },
  });

  /**
   * Auto generate set mutation
   */
  const autoGenerateMutation = useMutation({
    mutationFn: ({ contestId, body }: { contestId: string; body: questionsApi.AutoGenerateQuestionsInput }) =>
      questionsApi.autoGenerateQuestions(contestId, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['questions', 'list'] });
      if (variables.contestId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.questions.contestQuestions(variables.contestId),
        });
      }
    },
  });

  // Extract nested data structure
  const questions = questionsQuery.data?.data?.questions;
  const pagination = questionsQuery.data?.data?.pagination;
  const isLoading = questionsQuery.isLoading;
  const isFetching = questionsQuery.isFetching;

  return {
    // Query objects
    questionsQuery,

    // Mutations
    createQuestionMutation,
    bulkCreateMutation,
    updateQuestionMutation,
    deleteQuestionMutation,
    autoGenerateMutation,

    // Derived state
    questions,
    pagination,
    isLoading,
    isFetching,
  };
}
/**
 * Hook for fetching distinct tags across all questions in the organization
 */
export function useQuestionTags() {
  const tagsQuery = useQuery({
    queryKey: ['questions', 'tags'],
    queryFn: () => questionsApi.getDistinctTags(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const tags = tagsQuery.data?.data?.tags || [];
  const isLoading = tagsQuery.isLoading;

  return {
    tags,
    isLoading,
    tagsQuery
  };
}

/**
 * Hook for fetching a single question's details by its ID
 */
export function useQuestion(questionId: string | null) {
  const questionQuery = useQuery({
    queryKey: queryKeys.questions.detail(questionId as string),
    queryFn: () => questionsApi.getQuestion(questionId as string),
    enabled: !!questionId,
  });

  const question = questionQuery.data?.data;
  const isLoading = questionQuery.isLoading;
  const isFetching = questionQuery.isFetching;

  return {
    questionQuery,
    question,
    isLoading,
    isFetching,
  };
}
