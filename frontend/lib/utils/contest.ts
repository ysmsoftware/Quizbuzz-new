import { Contest, ContestPhase } from '@/lib/types';

export function deriveContestPhase(contest: Contest): ContestPhase {
  if (contest.cancelledAt) return 'CANCELLED';
  if (!contest.publishedAt) return 'DRAFT';
  
  const now = new Date();
  const start = new Date(contest.startTime);
  const end = new Date(start.getTime() + contest.durationMinutes * 60 * 1000);
  const deadline = new Date(contest.registrationDeadline);
  
  if (now < deadline) return 'PUBLISHED';
  if (now >= deadline && now < start) return 'REGISTRATION_CLOSED';
  if (now >= start && now < end) return 'LIVE';
  
  if (contest.resultsPublishedAt) return 'RESULTS_PUBLISHED';
  return 'ENDED';
}
