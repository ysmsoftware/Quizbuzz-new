import { toast } from 'sonner';

/**
 * Single responsibility: turn a PLAN_LIMIT_EXCEEDED API error into a visible
 * toast with an "Upgrade Plan" action. Kept out of apiClient.ts so the HTTP
 * client stays limited to "make the request, parse the response" — this is
 * the one place that decides what the user actually sees for this specific
 * error code.
 */

export interface PlanLimitToastInput {
  message: string;
  limitType?: string;
  limit?: number;
  current?: number;
}

const LIMIT_TYPE_LABELS: Record<string, string> = {
  contestsPerCycle: 'contests this billing cycle',
  participantsPerContest: 'participants for this contest',
  questionsPerContest: 'questions for this contest',
  orgMembers: 'organization members',
};

function describeLimit(input: PlanLimitToastInput): string | undefined {
  if (!input.limitType || input.limit === undefined) return undefined;
  const label = LIMIT_TYPE_LABELS[input.limitType] ?? input.limitType;
  return `${input.current ?? input.limit}/${input.limit} ${label}`;
}

export function notifyPlanLimitExceeded(input: PlanLimitToastInput): void {
  const detail = describeLimit(input);

  toast.error(input.message, {
    description: detail,
    duration: 8000,
    action: {
      label: 'Upgrade Plan',
      onClick: () => {
        window.location.href = '/org/settings?tab=billing';
      },
    },
  });
}
