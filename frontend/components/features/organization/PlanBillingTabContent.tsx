'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOnboardingPlans } from '@/lib/hooks/useOnboarding';
import { useOrgUsage } from '@/lib/hooks/useOrganization';
import { startingPrice, startingPriceIsMonthly } from '@/lib/utils/plan-pricing';
import { UpgradePromptModal } from './UpgradePromptModal';
import { PlanUsageBars } from './PlanUsageBars';
import { CreditCard, Calendar, ArrowUpCircle, Loader2 } from 'lucide-react';

interface PlanBillingTabContentProps {
  /** The `org` object returned by useOrganization — includes planSlug/planStatus/planLimitsCache. */
  org: {
    id: string;
    planSlug?: string | null;
    planStatus?: string | null;
    planLimitsCache?: Record<string, any> | null;
  };
}

/**
 * Read-only current-plan summary + an Upgrade button that redirects into the
 * ops billing-portal checkout (same handoff-token mechanism onboarding uses).
 *
 * Deliberately does NOT offer self-serve downgrade/change-plan here — only
 * upgrading to a paid plan. Downgrades stay ops-admin-only for now.
 */
export function PlanBillingTabContent({ org }: PlanBillingTabContentProps) {
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const plansQuery = useOnboardingPlans(true);
  const usageQuery = useOrgUsage(org.id);
  const plans = plansQuery.data?.data ?? [];

  const planSlug = org.planSlug || 'free';
  const currentPlan = plans.find((p) => p.slug === planSlug);
  const cache = org.planLimitsCache || {};
  const billingCycle: 'MONTHLY' | 'ANNUAL' | undefined = cache.billingCycle;
  const currentPeriodEnd: string | undefined = cache.currentPeriodEnd;

  // Prefer the price for the cycle they're actually on; fall back to the
  // plan's lowest advertised price if we don't have a cycle on record yet
  // (e.g. a free plan that's never gone through checkout).
  const displayPrice = (() => {
    if (!currentPlan) return null;
    if (billingCycle === 'ANNUAL' && currentPlan.annualPrice != null) return currentPlan.annualPrice;
    if (billingCycle === 'MONTHLY' && currentPlan.monthlyPrice != null) return currentPlan.monthlyPrice;
    return startingPrice(currentPlan);
  })();
  const displayIsMonthly = currentPlan
    ? billingCycle === 'ANNUAL'
      ? false
      : billingCycle === 'MONTHLY'
      ? true
      : startingPriceIsMonthly(currentPlan)
    : true;

  const statusLabel = (org.planStatus || 'ACTIVE').toUpperCase();
  const statusStyles =
    statusLabel === 'ACTIVE'
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
      : statusLabel === 'PAST_DUE' || statusLabel === 'SUSPENDED'
      ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      : 'bg-muted text-muted-foreground border-border';

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>The subscription plan and billing cycle your organization is currently on</CardDescription>
        </CardHeader>
        <CardContent>
          {plansQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading plan details…
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-foreground">
                      {currentPlan?.name || planSlug}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyles}`}>
                      {statusLabel}
                    </span>
                  </div>
                  {currentPlan?.description && (
                    <p className="text-xs text-muted-foreground mt-1 max-w-md">{currentPlan.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-primary">
                    {displayPrice === null || displayPrice === 0 ? 'Free' : `₹${displayPrice.toLocaleString('en-IN')}`}
                  </span>
                  {displayPrice !== null && displayPrice > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">/{displayIsMonthly ? 'mo' : 'yr'}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border/50 bg-secondary/20">
                  <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Billing Cycle</p>
                    <p className="text-sm font-semibold text-foreground">
                      {billingCycle === 'ANNUAL' ? 'Annual' : billingCycle === 'MONTHLY' ? 'Monthly' : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border/50 bg-secondary/20">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Renews On</p>
                    <p className="text-sm font-semibold text-foreground">
                      {currentPeriodEnd ? format(new Date(currentPeriodEnd), 'MMM d, yyyy') : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={() => setIsUpgradeOpen(true)} className="gap-2">
                  <ArrowUpCircle className="h-4 w-4" />
                  Upgrade Plan
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="pt-6">
          {usageQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading usage…
            </div>
          ) : usageQuery.data?.data ? (
            <PlanUsageBars usage={usageQuery.data.data} />
          ) : null}
        </CardContent>
      </Card>

      <UpgradePromptModal open={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} />
    </div>
  );
}

export default PlanBillingTabContent;
