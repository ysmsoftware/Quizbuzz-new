import type { Contest, ServerContest } from '@/lib/types';
import type { ContestPhase } from '@/lib/types';

const BACKEND_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'REGISTRATION_CLOSED',
  'LIVE',
  'EVALUATION',
  'RESULTS_OUT',
  'COMPLETED',
  'CANCELLED',
] as const;

export type BackendContestStatus = (typeof BACKEND_STATUSES)[number];

/** Raw status string from the API — never use adapted lowercase status. */
export function getServerContestStatus(
  contest: Contest | ServerContest | { serverStatus?: string; status?: string },
): BackendContestStatus | string {
  const fromServer = (contest as Contest & { serverStatus?: string }).serverStatus;
  if (fromServer && BACKEND_STATUSES.includes(fromServer.toUpperCase() as BackendContestStatus)) {
    return fromServer.toUpperCase() as BackendContestStatus;
  }

  const raw = String((contest as ServerContest).status ?? '').toUpperCase();
  if (BACKEND_STATUSES.includes(raw as BackendContestStatus)) {
    return raw as BackendContestStatus;
  }

  return 'DRAFT';
}

const STATUS_TO_PHASE: Record<BackendContestStatus, ContestPhase> = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  LIVE: 'LIVE',
  EVALUATION: 'ENDED',
  RESULTS_OUT: 'RESULTS_PUBLISHED',
  COMPLETED: 'RESULTS_PUBLISHED',
  CANCELLED: 'CANCELLED',
};

export function deriveContestPhase(
  contest: Contest | ServerContest,
): ContestPhase {
  const status = getServerContestStatus(contest);
  const phase = STATUS_TO_PHASE[status as BackendContestStatus] ?? 'DRAFT';

  // The backend only flips PUBLISHED -> REGISTRATION_CLOSED when an admin explicitly
  // closes registration early (ContestService.closeRegistration) or when the contest
  // goes LIVE — there's no scheduled job that flips it purely because the deadline
  // passed, because nothing downstream needs that status change: new registrations are
  // already correctly rejected past the deadline by a live time check in
  // ContestService.registerParticipant, independent of the stored status string. That
  // leaves the admin-facing phase badge reading a technically-true-but-stale PUBLISHED
  // status once the deadline passes — this mirrors the same time check the public
  // contest page already applies (lib/contestStatus.ts's getContestPhase), so the admin
  // dashboard doesn't keep showing "Open for Registration" after registration has
  // actually closed (no refresh will fix it, because the underlying status genuinely
  // hasn't changed — this was never a stale-cache issue).
  if (phase === 'PUBLISHED') {
    const deadline = new Date((contest as { registrationDeadline?: string }).registrationDeadline ?? '');
    if (!Number.isNaN(deadline.getTime()) && Date.now() > deadline.getTime()) {
      return 'REGISTRATION_CLOSED';
    }
  }

  return phase;
}

export function isContestLive(contest: Contest | ServerContest): boolean {
  return getServerContestStatus(contest) === 'LIVE';
}
