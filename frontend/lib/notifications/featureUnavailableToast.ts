import { toast } from 'sonner';

/**
 * Single responsibility: turn a FEATURE_DISABLED API error into a visible
 * toast, mirroring planLimitToast.ts's PLAN_LIMIT_EXCEEDED handling — same
 * "one place decides what the user sees for this error code" reasoning.
 *
 * The product requirement this satisfies: turning a feature off (globally or
 * for one organization) must never be a silent no-op — a blocked request
 * needs to visibly tell the user why, not just fail or do nothing.
 */

export interface FeatureUnavailableToastInput {
  message: string;
  featureKey?: string;
}

export function notifyFeatureUnavailable(input: FeatureUnavailableToastInput): void {
  toast.error(input.message || 'This feature is currently unavailable.', {
    description: 'Please try again later, or contact support if this persists.',
    duration: 8000,
  });
}
