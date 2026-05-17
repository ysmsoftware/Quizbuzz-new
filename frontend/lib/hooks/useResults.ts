import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { submissionService } from '@/lib/services/submission-service';
import { MockDB } from '@/lib/mock/db';
import type { QuizResult } from '@/lib/types';

async function fetchResults(contestId: string): Promise<QuizResult[]> {
  if (contestId === 'all') {
    const submissions = MockDB.submissions.filter((submission) => submission.status === 'submitted');

    return submissions.map((submission, index) => {
      const score = Math.min(100, Math.max(0, Math.floor(Math.random() * 101)));
      const correctAnswers = Math.min(30, Math.max(0, Math.floor(Math.random() * 25)));
      const wrongAnswers = Math.min(20, Math.max(0, Math.floor(Math.random() * 15)));
      const unattempted = Math.max(0, 30 - correctAnswers - wrongAnswers);
      const orderedIndex = index + 1;

      return {
        attemptId: submission.id,
        contestId: submission.contestId,
        participantId: submission.participantId,
        participantName: submission.participantId,
        score,
        totalMarks: 100,
        correctAnswers,
        wrongAnswers,
        unattempted,
        timeTaken: `${Math.floor(submission.timeSpentSeconds / 60)} mins`,
        rank: orderedIndex,
        totalParticipants: submissions.length,
        percentile: Number((100 - (orderedIndex / submissions.length) * 100).toFixed(2)),
        isPassed: score >= 40,
        breakdown: [],
      };
    });
  }

  const response = await submissionService.getResults(contestId);
  return response.data ?? [];
}

export function useResults(contestId: string) {
  const query = useQuery({
    queryKey: ['results', contestId],
    queryFn: () => fetchResults(contestId),
    enabled: !!contestId,
  });

  const results = query.data ?? [];

  const getLeaderboard = useCallback(() => {
    return [...results].sort((a, b) => b.score - a.score).slice(0, 10);
  }, [results]);

  return {
    results,
    loading: query.isLoading,
    error: query.error as Error | null,
    getLeaderboard,
  };
}
