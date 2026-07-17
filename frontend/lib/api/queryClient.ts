/**
 * TanStack Query configuration
 * 
 * This file exports:
 * 1. queryClient — singleton instance (for use in mutations' onSuccess callbacks)
 * 2. queryKeys — centralized key object for all queries
 * 
 * Note: components/providers/query-provider.tsx creates its own QueryClient instance
 * and wraps the app in QueryClientProvider. This export is for cache invalidation.
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton QueryClient for use in mutation callbacks (e.g., onSuccess invalidations).
 * The app's QueryClientProvider creates its own instance to wrap the app.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Centralized query keys
 * Structure: queryKeys.module.detail(id) → ["module", id]
 */
export const queryKeys = {
  auth: {
    me: ['auth', 'me'],
  },

  org: {
    detail: (orgId: string) => ['org', orgId],
    members: (orgId: string) => ['org', orgId, 'members'],
  },

  contests: {
    list: (filters?: any) => ['contests', 'list', filters],
    detail: (id: string) => ['contests', id],
    participants: (contestId: string, params?: any) => [
      'contests',
      contestId,
      'participants',
      params,
    ],
    participant: (contestId: string, participantId: string) => [
      'contests',
      contestId,
      'participants',
      participantId,
    ],
    leaderboard: (contestId: string, page?: number) => [
      'contests',
      contestId,
      'leaderboard',
      page,
    ],
  },

  questions: {
    list: (filters?: any) => ['questions', 'list', filters],
    detail: (id: string) => ['questions', id],
    contestQuestions: (contestId: string) => ['questions', 'contest', contestId],
  },

  payments: {
    status: (participantId: string) => ['payments', 'status', participantId],
    list: (contestId: string, filters?: any) => ['payments', 'list', contestId, filters],
  },

  public: {
    contest: (slug: string) => ['public', 'contest', slug],
  },

  registration: {
    // public endpoints — no auth required
  },

  onboarding: {
    status: ['onboarding', 'status'],
    plans:  ['onboarding', 'plans'],
  },
} as const;
