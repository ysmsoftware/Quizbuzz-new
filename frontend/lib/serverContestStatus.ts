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
  return STATUS_TO_PHASE[status as BackendContestStatus] ?? 'DRAFT';
}

export function isContestLive(contest: Contest | ServerContest): boolean {
  return getServerContestStatus(contest) === 'LIVE';
}
