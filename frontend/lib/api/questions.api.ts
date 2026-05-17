/**
 * Questions API Functions
 * 
 * Maps directly to 04-questions.md endpoints.
 * Base path: /questions
 */

import { del, get, patch, post } from './apiClient';
import type { ApiResponse } from './apiClient';

export interface Question {
  id: string;
  questionText: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  tags: string[];
  options: any[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface QuestionListResponse {
  questions: Question[];
  pagination: PaginationInfo;
}

/**
 * GET /questions
 */
export async function listQuestions(params?: {
  difficulty?: string;
  tags?: string | string[];
  search?: string;
  contestId?: string;
  unassignedFor?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<QuestionListResponse>> {
  const query = new URLSearchParams();

  if (params?.difficulty) query.append('difficulty', params.difficulty);
  if (params?.search) query.append('search', params.search);
  if (params?.contestId) query.append('contestId', params.contestId);
  if (params?.unassignedFor) query.append('unassignedFor', params.unassignedFor);
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));

  // Handle tags as comma-separated string
  if (params?.tags) {
    const tagsStr = Array.isArray(params.tags) ? params.tags.join(',') : params.tags;
    if (tagsStr) query.append('tags', tagsStr);
  }

  const path = `/questions${query.toString() ? '?' + query.toString() : ''}`;
  return get(path);
}

/**
 * POST /questions
 */
export async function createQuestion(body: any): Promise<ApiResponse> {
  return post('/questions', body);
}

/**
 * POST /questions/bulk
 */
export async function bulkCreateQuestions(questions: any[]): Promise<ApiResponse> {
  return post('/questions/bulk', { questions });
}

/**
 * GET /questions/tags
 */
export async function getDistinctTags(): Promise<ApiResponse<{ tags: string[] }>> {
  return get('/questions/tags');
}

/**
 * GET /questions/:questionId
 */
export async function getQuestion(questionId: string): Promise<ApiResponse> {
  return get(`/questions/${questionId}`);
}

/**
 * PATCH /questions/:questionId
 */
export async function updateQuestion(questionId: string, body: any): Promise<ApiResponse> {
  return patch(`/questions/${questionId}`, body);
}

/**
 * DELETE /questions/:questionId
 */
export async function deleteQuestion(questionId: string): Promise<ApiResponse> {
  return del(`/questions/${questionId}`);
}

/**
 * GET /questions/contests/:contestId/questions
 */
export async function getContestQuestions(contestId: string): Promise<ApiResponse> {
  return get(`/questions/contests/${contestId}/questions`);
}

/**
 * POST /questions/contests/:contestId/questions
 */
export async function assignQuestionsToContest(
  contestId: string,
  questions: Array<{
    questionId: string;
    position: number;
    marks: number;
    negativeMark?: number;
  }>
): Promise<ApiResponse> {
  return post(`/questions/contests/${contestId}/questions`, { questions });
}

/**
 * PATCH /questions/contests/:contestId/questions/:questionId
 */
export async function updateContestQuestion(
  contestId: string,
  questionId: string,
  body: { marks?: number; negativeMark?: number }
): Promise<ApiResponse> {
  return patch(`/questions/contests/${contestId}/questions/${questionId}`, body);
}

/**
 * DELETE /questions/contests/:contestId/questions/:questionId
 */
export async function removeContestQuestion(
  contestId: string,
  questionId: string
): Promise<ApiResponse> {
  return del(`/questions/contests/${contestId}/questions/${questionId}`);
}
