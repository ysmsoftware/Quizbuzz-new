import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPublicLeaderboard, getParticipantSubmission } from '@/lib/api/submissions.api';
import type { QuizResult, LeaderboardEntry } from '@/lib/types';

// Ranking ties on score and is broken by exact time taken down to the
// millisecond (leaderboard.worker.ts already sorts this precisely) — but the
// UI previously only ever showed whole minutes, discarding timeTakenMs even
// though the API already returns it. See results-page scoring audit, issue 1.
function formatTimeTaken(
  timeTakenMs: number | null | undefined,
  timeTakenSecs: number | null | undefined,
): string {
  const totalMs = Math.max(
    0,
    Math.round(typeof timeTakenMs === 'number' ? timeTakenMs : (timeTakenSecs ?? 0) * 1000),
  );
  const minutes = Math.floor(totalMs / 60000);
  const secondsWithMs = (totalMs % 60000) / 1000;
  // Verbose word format per request: "9 mins, 54.752 sec" (was "9:54.752").
  return `${minutes} mins, ${secondsWithMs.toFixed(3)} sec`;
}

export function useResults(contestId: string, participantId?: string) {
  // 1. Fetch public leaderboard
  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', contestId],
    queryFn: () => getPublicLeaderboard(contestId),
    enabled: !!contestId,
  });

  // 2. Fetch specific participant's submission details (only if participantId is provided)
  const participantQuery = useQuery({
    queryKey: ['participantSubmission', contestId, participantId],
    queryFn: () => getParticipantSubmission(participantId!, { contestId }),
    enabled: !!contestId && !!participantId,
  });

  // 3. Map leaderboard
  const rawLeaderboard = leaderboardQuery.data?.data?.entries || [];
  const leaderboard = rawLeaderboard.map((entry: any): LeaderboardEntry => ({
    rank: Number(entry.rank),
    participantId: entry.participantId,
    participantName: entry.participant?.contact
      ? `${entry.participant.contact.firstName} ${entry.participant.contact.lastName ?? ''}`.trim()
      : entry.participantId,
    score: Number(entry.score ?? 0),
    timeTaken: formatTimeTaken(entry.timeTakenMs, entry.timeTakenSecs),
  }));

  // 4. Map participant results list
  const results: QuizResult[] = [];
  if (participantQuery.data?.data) {
    const sub = participantQuery.data.data;
    results.push({
      attemptId: sub.id,
      contestId: sub.contestId,
      participantId: sub.participantId,
      participantName: sub.contactName || sub.participantId,
      score: Number(sub.score ?? 0),
      // Real max-possible-score from the API now that it exists — falls back
      // to the old (only correct when marks-per-question is 1) behavior if
      // an older/cached response ever lacks the field.
      totalMarks: Number(sub.totalMarks ?? sub.totalQuestions ?? 0),
      totalQuestions: Number(sub.totalQuestions ?? 0),
      correctAnswers: Number(sub.correct ?? 0),
      wrongAnswers: Number(sub.wrong ?? 0),
      unattempted: Number(sub.skipped ?? 0),
      timeTaken: formatTimeTaken(sub.timeTakenMs, sub.timeTakenSecs),
      rank: Number(sub.rank ?? 0),
      totalParticipants: Number(sub.totalParticipants ?? 0),
      percentile: Number(sub.percentile ?? 0),
      isPassed: !!sub.isPassed,
      breakdown: (sub.answers || []).map((ans: any, idx: number) => ({
        questionId: ans.questionId,
        questionNumber: idx + 1,
        questionText: ans.questionText || '',
        yourAnswer: ans.selectedOptionText ? [ans.selectedOptionText] : [],
        correctAnswer: ans.correctOptionText ? [ans.correctOptionText] : [],
        isCorrect: !!ans.isCorrect,
        marksObtained: Number(ans.marksAwarded ?? 0),
        maxMarks: Number(ans.maxMarks ?? 1),
        negativeMark: Number(ans.negativeMark ?? 0),
      })),
    });
  }

  const getLeaderboard = useCallback(() => {
    return leaderboard;
  }, [leaderboard]);

  return {
    results,
    loading: leaderboardQuery.isLoading || (!!participantId && participantQuery.isLoading),
    error: (leaderboardQuery.error || participantQuery.error) as Error | null,
    getLeaderboard,
  };
}
