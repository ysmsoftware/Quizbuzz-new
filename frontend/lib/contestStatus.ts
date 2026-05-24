/**
 * Public contest phase derived from schedule + API status.
 */
export type PublicContestPhase =
  | 'registration_open'
  | 'registration_closed'
  | 'live'
  | 'ended';

export function getContestEndTime(contest: {
  startTime: string;
  duration: number;
  endTime?: string;
}): string {
  if (contest.endTime) return contest.endTime;
  return new Date(
    new Date(contest.startTime).getTime() + contest.duration * 60_000,
  ).toISOString();
}

export function getContestPhase(contest: {
  registrationDeadline: string;
  startTime: string;
  duration: number;
  endTime?: string;
  status: string;
}): PublicContestPhase {
  const now = Date.now();
  const regDeadline = new Date(contest.registrationDeadline).getTime();
  const start = new Date(contest.startTime).getTime();
  const end = new Date(getContestEndTime(contest)).getTime();
  const status = contest.status.toUpperCase();

  if (['EVALUATION', 'RESULTS_OUT', 'COMPLETED', 'CANCELLED'].includes(status)) {
    return 'ended';
  }
  if (now >= end || status === 'LIVE' && now >= end) return 'ended';
  if (now >= start || status === 'LIVE') return 'live';
  if (now > regDeadline || status === 'REGISTRATION_CLOSED') return 'registration_closed';
  if (status === 'PUBLISHED') return 'registration_open';
  return 'registration_closed';
}

export const publicPhaseBanner: Record<
  PublicContestPhase,
  { label: string; className: string }
> = {
  registration_open: {
    label: 'Registration Open',
    className: 'bg-primary/10 text-primary',
  },
  registration_closed: {
    label: 'Registration Closed',
    className: 'bg-warning/10 text-warning-foreground',
  },
  live: {
    label: 'Contest Live',
    className: 'bg-success/10 text-success',
  },
  ended: {
    label: 'Contest Ended',
    className: 'bg-secondary text-secondary-foreground',
  },
};
