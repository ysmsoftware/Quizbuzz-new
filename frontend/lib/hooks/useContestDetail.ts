'use client';

import { useContest } from './useContest';

/**
 * Contest detail hook
 * 
 * Thin wrapper over useContest for backward compatibility.
 */
export function useContestDetail(contestId: string) {
  const result = useContest(contestId);
  return { 
    ...result,
    data: result.contest, 
    isLoading: result.loading, 
    error: result.error, 
    refetch: () => result.contestQuery.refetch(),
  };
}
