import type { PlanOption } from '@/lib/api/onboarding.api';

/**
 * Shared plan-pricing helpers for anywhere a PlanOption (from the ops
 * billing-portal catalog, GET /onboarding/plans) needs to be rendered or
 * reasoned about — currently the post-onboarding UpgradePromptModal and the
 * Settings "Plan & Billing" tab.
 *
 * Kept in one place deliberately: this is the exact logic that was buggy
 * before (comparing a `price` field the ops API no longer returns), so any
 * future consumer should import these instead of re-deriving them.
 */

/**
 * A plan is "paid" if it charges anything on any cycle it offers. The ops
 * checkout page (opened via the billing handoff token) is where the actual
 * cycle gets picked and the real total gets calculated — this is only used
 * to decide free-instant-access vs. redirect-to-checkout.
 */
export function isPaidPlan(plan: PlanOption): boolean {
  return (
    (plan.allowsMonthly && (plan.monthlyPrice ?? 0) > 0) ||
    (plan.allowsAnnual && (plan.annualPrice ?? 0) > 0)
  );
}

/** Lowest advertised price for display purposes only. */
export function startingPrice(plan: PlanOption): number | null {
  if (plan.allowsMonthly && plan.monthlyPrice != null) return plan.monthlyPrice;
  if (plan.allowsAnnual && plan.annualPrice != null) return plan.annualPrice;
  return null;
}

/** Whether the starting price above is a monthly or yearly figure. */
export function startingPriceIsMonthly(plan: PlanOption): boolean {
  return plan.allowsMonthly && plan.monthlyPrice != null;
}
