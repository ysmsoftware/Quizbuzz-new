import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contestService } from '@/lib/services/contest-service';
import { MockDB } from '@/lib/mock/db';
import type { Contest } from '@/lib/types';

export function useParticipantDashboard(participantId: string) {
  const contestsQuery = useQuery({
    queryKey: ['participant-dashboard', participantId],
    queryFn: () => contestService.getContests(),
    enabled: !!participantId,
  });

  const contests: Contest[] = contestsQuery.data?.data ?? [];

  const registrations = useMemo(() => {
    const reg = new Set(
      MockDB.registrations
        .filter((r) => r.participantId === participantId)
        .map((registration) => registration.contestId)
    );

    return reg;
  }, [participantId]);

  const now = new Date();

  const groupedContests = useMemo(() => {
    const upcoming: Contest[] = [];
    const active: Contest[] = [];
    const past: Contest[] = [];

    contests.forEach((contest) => {
      const start = contest.contestStartTime ? new Date(`${contest.contestDate}T${contest.contestStartTime}`) : new Date();
      const end = contest.contestEndTime ? new Date(`${contest.contestDate}T${contest.contestEndTime}`) : new Date(start.getTime() + (contest.durationMinutes || 60) * 60000);

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
    registrations,
    loading: contestsQuery.isLoading,
  };
}
