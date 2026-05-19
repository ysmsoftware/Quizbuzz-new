import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contestService } from '@/lib/services/contest-service';
import type { PublicContestSummary } from '@/lib/types/public-contest';

export function useParticipantDashboard(participantId: string) {
  const contestsQuery = useQuery({
    queryKey: ['participant-dashboard', participantId],
    queryFn: () => contestService.getContests(),
    enabled: !!participantId,
  });

  const contests: PublicContestSummary[] = contestsQuery.data?.data ?? [];

  const now = new Date();

  const groupedContests = useMemo(() => {
    const upcoming: PublicContestSummary[] = [];
    const active: PublicContestSummary[] = [];
    const past: PublicContestSummary[] = [];

    contests.forEach((contest) => {
      const start = new Date(contest.startTime);
      const end = new Date(start.getTime() + (contest.duration || 60) * 60000);

      if (start > now) {
        upcoming.push(contest);
      } else if (end > now) {
        active.push(contest);
      } else {
        past.push(contest);
      }
    });

    return { upcomingContests: upcoming, activeContests: active, pastContests: past };
  }, [contests, now]);

  return {
    ...groupedContests,
    loading: contestsQuery.isLoading,
  };
}
