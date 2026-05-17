'use client';

import { useContest } from './useContest';

/**
 * Contest detail hook
 * 
 * Thin wrapper over useContest for backward compatibility.
 */
export function useContestDetail(contestId: string) {
  const { contest, loading, error, contestQuery } = useContest(contestId);
  return { 
    data: contest, 
    isLoading: loading, 
    error, 
    refetch: () => contestQuery.refetch(),
    contestQuery 
  };
}
