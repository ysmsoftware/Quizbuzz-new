'use client';

import React, { useState } from 'react';
import { useOnboardingPlans } from '@/lib/hooks/useOnboarding';
import { createBillingHandoff, PlanOption } from '@/lib/api/onboarding.api';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle2, CreditCard, Sparkles, Loader2, X } from 'lucide-react';

interface UpgradePromptModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpgradePromptModal({ open, onClose }: UpgradePromptModalProps) {
  const plansQuery = useOnboardingPlans(open);
  const plans = plansQuery.data?.data ?? [];
  const [selectedSlug, setSelectedSlug] = useState<string>('free');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePlan = plans.find((p) => p.slug === selectedSlug) || plans[0];

  const handleProceed = async () => {
    if (!activePlan) return;
    setError(null);

    if (activePlan.price > 0) {
      try {
        setLoading(true);
        const res = await createBillingHandoff(activePlan.slug);
        if (res.data?.checkoutUrl) {
          window.location.href = res.data.checkoutUrl;
          return;
        }
      } catch (err: any) {
        setError(err?.message ?? 'Failed to initialize checkout. Please try again.');
        setLoading(false);
      }
    } else {
      // Free plan selected — close prompt
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-3xl p-0 overflow-hidden border-border bg-card shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />

        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace Ready
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Choose your QuizBuzz Plan
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Unlock advanced proctoring, custom domains, and elevated contest limits.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Grid Layout for Plans */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
            {plans.length > 0 ? (
              plans.map((plan: PlanOption) => {
                const isSelected = selectedSlug === plan.slug;
                return (
                  <div
                    key={plan.slug}
                    onClick={() => setSelectedSlug(plan.slug)}
                    className={cn(
                      'flex flex-col justify-between p-5 rounded-xl border-2 transition-all cursor-pointer relative',
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md scale-[1.02]'
                        : 'border-border hover:border-primary/40 bg-card'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-base">{plan.name}</h4>
                        {isSelected && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                        {plan.description}
                      </p>
                      <div className="mb-4">
                        <span className="text-3xl font-extrabold text-primary">
                          {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                        </span>
                        {plan.price > 0 && <span className="text-xs text-muted-foreground ml-1">/mo</span>}
                      </div>

                      <ul className="space-y-2 border-t border-border/40 pt-4">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-xs text-foreground/90">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
                Loading available plans…
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              Continue with Free Plan
            </Button>
            <Button
              onClick={handleProceed}
              disabled={loading || plansQuery.isLoading}
              size="sm"
              className="gap-2 px-6"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : activePlan && activePlan.price > 0 ? (
                <>
                  <CreditCard className="h-4 w-4" />
                  Proceed to Checkout
                </>
              ) : (
                'Start using QuizBuzz'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
