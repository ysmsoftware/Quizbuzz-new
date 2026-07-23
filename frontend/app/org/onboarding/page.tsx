'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  useOnboardingStatus,
  useSaveOnboardingStep,
  useCompleteOnboarding,
  useOnboardingPlans,
} from '@/lib/hooks/useOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Building2,
  Target,
  Radio,
  MapPin,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Heart,
} from 'lucide-react';

import { ChipSelect } from '@/components/shared/ChipSelect';
import { USE_CASES, ORG_SIZES, CONTEST_VOLUMES, PARTICIPANT_VOLUMES, HEARD_SOURCES } from '@/lib/constants/org-profile-options';

// ─── Step definitions — no per-step color, uses design tokens throughout ──────

const STEPS = [
  { key: 'IDENTITY',       label: 'Your Organization', icon: Building2 },
  { key: 'USE_CASE',       label: 'What You Do',       icon: Target    },
  { key: 'ATTRIBUTION',    label: 'How You Found Us',  icon: Radio     },
  { key: 'CONTACT_LOCALE', label: 'Contact & Region',  icon: MapPin    },
  { key: 'PLAN_SELECTION', label: 'Choose a Plan',     icon: CreditCard},
] as const;

type StepKey = (typeof STEPS)[number]['key'];

// ─── Step forms ───────────────────────────────────────────────────────────────

function IdentityStep({
  data,
  onChange,
}: {
  data: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="ob-logo-url">
          Logo URL{' '}
          <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </Label>
        <Input
          id="ob-logo-url"
          placeholder="https://example.com/logo.png"
          value={data.logoUrl ?? ''}
          onChange={(e) => onChange('logoUrl', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ob-website">
          Website{' '}
          <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </Label>
        <Input
          id="ob-website"
          placeholder="https://yourorganization.com"
          value={data.website ?? ''}
          onChange={(e) => onChange('website', e.target.value)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        These help personalize your QuizBuzz workspace. You can update them anytime in Settings.
      </p>
    </div>
  );
}

function UseCaseStep({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (k: string, v: unknown) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        <Label>What best describes your organization?</Label>
        <ChipSelect
          options={USE_CASES as any}
          value={data.primaryUseCase as string ?? null}
          onChange={(v) => onChange('primaryUseCase', v)}
        />
        {data.primaryUseCase === 'OTHER' && (
          <Input
            placeholder="Describe your use case…"
            value={data.useCaseOther as string ?? ''}
            onChange={(e) => onChange('useCaseOther', e.target.value)}
            className="mt-1.5"
          />
        )}
      </div>

      <div className="space-y-2.5">
        <Label>Organization size</Label>
        <ChipSelect
          options={ORG_SIZES as any}
          value={data.sizeBucket as string ?? null}
          onChange={(v) => onChange('sizeBucket', v)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2.5">
          <Label>Contests per month</Label>
          <ChipSelect
            options={CONTEST_VOLUMES as any}
            value={data.expectedContestsPerMonth as string ?? 'UNSURE'}
            onChange={(v) => onChange('expectedContestsPerMonth', v)}
          />
        </div>
        <div className="space-y-2.5">
          <Label>Participants per contest</Label>
          <ChipSelect
            options={PARTICIPANT_VOLUMES as any}
            value={data.expectedParticipants as string ?? 'UNSURE'}
            onChange={(v) => onChange('expectedParticipants', v)}
          />
        </div>
      </div>
    </div>
  );
}

function AttributionStep({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (k: string, v: unknown) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        <Label>How did you hear about QuizBuzz?</Label>
        <ChipSelect
          options={HEARD_SOURCES as any}
          value={data.heardAboutSource as string ?? null}
          onChange={(v) => onChange('heardAboutSource', v)}
        />
        {data.heardAboutSource === 'OTHER' && (
          <Input
            placeholder="Tell us more…"
            value={data.heardAboutOther as string ?? ''}
            onChange={(e) => onChange('heardAboutOther', e.target.value)}
            className="mt-1.5"
          />
        )}
      </div>

      {/* Marketing opt-in toggle — uses design tokens */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-secondary/40">
        <Heart className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Stay in the loop</p>
          <p className="text-xs text-muted-foreground">
            Product updates, tips, and feature announcements
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange('marketingOptIn', !(data.marketingOptIn ?? false))}
          aria-label="Toggle marketing emails"
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            data.marketingOptIn ? 'bg-primary' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              data.marketingOptIn ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>
    </div>
  );
}

function ContactLocaleStep({
  data,
  onChange,
}: {
  data: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ob-contact-name">Contact Name</Label>
          <Input id="ob-contact-name" placeholder="Jane Smith" value={data.primaryContactName ?? ''} onChange={(e) => onChange('primaryContactName', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-contact-email">Contact Email</Label>
          <Input id="ob-contact-email" type="email" placeholder="jane@yourorg.com" value={data.primaryContactEmail ?? ''} onChange={(e) => onChange('primaryContactEmail', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ob-contact-phone">Contact Phone</Label>
          <Input id="ob-contact-phone" placeholder="+91 98765 43210" value={data.primaryContactPhone ?? ''} onChange={(e) => onChange('primaryContactPhone', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-country">Country</Label>
          <Input id="ob-country" placeholder="India" value={data.country ?? ''} onChange={(e) => onChange('country', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ob-state">State</Label>
          <Input id="ob-state" placeholder="Maharashtra" value={data.state ?? ''} onChange={(e) => onChange('state', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-city">City</Label>
          <Input id="ob-city" placeholder="Mumbai" value={data.city ?? ''} onChange={(e) => onChange('city', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ob-timezone">Timezone</Label>
          <Input id="ob-timezone" placeholder="Asia/Kolkata" value={data.timezone ?? ''} onChange={(e) => onChange('timezone', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-currency">Currency</Label>
          <Input id="ob-currency" placeholder="INR" maxLength={3} value={data.preferredCurrency ?? 'INR'} onChange={(e) => onChange('preferredCurrency', e.target.value.toUpperCase())} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ob-gst">
          GST Number{' '}
          <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </Label>
        <Input id="ob-gst" placeholder="22AAAAA0000A1Z5" value={data.gstNumber ?? ''} onChange={(e) => onChange('gstNumber', e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ob-billing">
          Billing Address{' '}
          <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </Label>
        <Input id="ob-billing" placeholder="123 Main St, Mumbai, MH 400001" value={data.billingAddress ?? ''} onChange={(e) => onChange('billingAddress', e.target.value)} />
      </div>
    </div>
  );
}

function PlanSelectionStep({
  plans,
  selectedSlug,
  onSelect,
}: {
  plans: import('@/lib/api/onboarding.api').PlanOption[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="space-y-4">
      {plans.map((plan) => {
        const isSelected = selectedSlug === plan.slug;
        return (
          <div
            key={plan.slug}
            onClick={() => onSelect(plan.slug)}
            className={cn(
              'p-6 rounded-xl border-2 transition-all cursor-pointer',
              isSelected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-primary/50 bg-card'
            )}
          >
            <div className="flex items-start justify-between mb-4 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {isSelected && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-1">{plan.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-extrabold text-primary">
                  {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.price === 0 ? 'forever' : 'per month'}
                </p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground text-center pt-1">
        Select a plan to continue setting up your workspace.
      </p>
    </div>
  );
}

// ─── Main wizard page ─────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { activeOrg, meQuery, isLoggedIn, isEmailVerified } = useAuth();

  const onboardingQuery    = useOnboardingStatus(!meQuery.isLoading && isLoggedIn && isEmailVerified);
  const plansQuery         = useOnboardingPlans(!meQuery.isLoading && isLoggedIn);
  const saveStepMutation   = useSaveOnboardingStep();
  const completeOnboarding = useCompleteOnboarding();

  // Step data keyed by step name
  const [stepData, setStepData] = useState<Record<StepKey, Record<string, unknown>>>({
    IDENTITY:       {},
    USE_CASE:       {},
    ATTRIBUTION:    {},
    CONTACT_LOCALE: {},
    PLAN_SELECTION: { planSlug: 'starter-test' },
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [error, setError]           = useState<string | null>(null);

  // Sync starting index from server state
  useEffect(() => {
    if (onboardingQuery.data?.data) {
      const serverStep = onboardingQuery.data.data.currentStep;
      const idx = STEPS.findIndex((s) => s.key === serverStep);
      if (idx >= 0) setCurrentIdx(idx);

      const profile = onboardingQuery.data.data.profile;
      if (profile) {
        setStepData((prev) => ({
          ...prev,
          USE_CASE: {
            primaryUseCase:           profile.primaryUseCase ?? '',
            useCaseOther:             profile.useCaseOther ?? '',
            sizeBucket:               profile.sizeBucket ?? '',
            expectedContestsPerMonth: profile.expectedContestsPerMonth,
            expectedParticipants:     profile.expectedParticipants,
          },
          ATTRIBUTION: {
            heardAboutSource: profile.heardAboutSource ?? '',
            heardAboutOther:  profile.heardAboutOther ?? '',
            marketingOptIn:   profile.marketingOptIn,
          },
          CONTACT_LOCALE: {
            primaryContactName:  profile.primaryContactName ?? '',
            primaryContactPhone: profile.primaryContactPhone ?? '',
            primaryContactEmail: profile.primaryContactEmail ?? '',
            country:             profile.country ?? '',
            state:               profile.state ?? '',
            city:                profile.city ?? '',
            timezone:            profile.timezone ?? '',
            preferredCurrency:   profile.preferredCurrency,
            gstNumber:           profile.gstNumber ?? '',
            billingAddress:      profile.billingAddress ?? '',
          },
        }));
      }
    }
  }, [onboardingQuery.data]);

  // If already completed, bounce to dashboard
  useEffect(() => {
    if (onboardingQuery.data?.data?.completed) {
      router.replace('/org');
    }
  }, [onboardingQuery.data, router]);

  const currentStep = STEPS[currentIdx];
  const plans       = plansQuery.data?.data ?? [];

  const selectedPlanSlug = (stepData.PLAN_SELECTION?.planSlug as string) || (plans[0]?.slug ?? 'free');
  const selectedPlan     = plans.find((p) => p.slug === selectedPlanSlug) || plans[0];

  function updateField(key: string, value: unknown) {
    setStepData((prev) => ({
      ...prev,
      [currentStep.key]: { ...prev[currentStep.key], [key]: value },
    }));
  }

  async function handleNext() {
    setError(null);
    try {
      await saveStepMutation.mutateAsync({
        step: currentStep.key,
        data: stepData[currentStep.key],
      });

      if (currentIdx < STEPS.length - 1) {
        setCurrentIdx((i) => i + 1);
      } else {
        // At PLAN_SELECTION step (final step)
        const currentSelectedSlug = (stepData.PLAN_SELECTION?.planSlug as string) || plans[0]?.slug;
        const activePlan = plans.find((p) => p.slug === currentSelectedSlug);

        if (activePlan && activePlan.price > 0) {
          // Paid plan: generate signed handoff token & redirect to Ops checkout
          const { createBillingHandoff } = await import('@/lib/api/onboarding.api');
          const handoffRes = await createBillingHandoff(activePlan.slug);

          if (handoffRes.data?.checkoutUrl) {
            window.location.href = handoffRes.data.checkoutUrl;
            return;
          }
        }

        // Free plan: complete onboarding directly
        await completeOnboarding.mutateAsync();
        router.replace('/org');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    }
  }

  function handleBack() {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
  }

  const isSubmitting = saveStepMutation.isPending || completeOnboarding.isPending;

  if (meQuery.isLoading || onboardingQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  const StepIcon = currentStep.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Subtle background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome to QuizBuzz
            {activeOrg?.name ? (
              <span className="text-primary">, {activeOrg.name}</span>
            ) : null}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Let's set up your workspace — it only takes a minute.
          </p>
        </div>

        {/* Step progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i < currentIdx
                  ? 'w-7 bg-primary'
                  : i === currentIdx
                    ? 'w-7 bg-primary'
                    : 'w-2 bg-muted'
              )}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="h-1 bg-primary" />

          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                <StepIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider leading-none mb-1">
                  Step {currentIdx + 1} of {STEPS.length}
                </p>
                <h2 className="text-lg font-semibold leading-tight">{currentStep.label}</h2>
              </div>
            </div>

            {/* Step content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.key}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {currentStep.key === 'IDENTITY' && (
                  <IdentityStep
                    data={stepData.IDENTITY as Record<string, string>}
                    onChange={updateField}
                  />
                )}
                {currentStep.key === 'USE_CASE' && (
                  <UseCaseStep data={stepData.USE_CASE} onChange={updateField} />
                )}
                {currentStep.key === 'ATTRIBUTION' && (
                  <AttributionStep data={stepData.ATTRIBUTION} onChange={updateField} />
                )}
                {currentStep.key === 'CONTACT_LOCALE' && (
                  <ContactLocaleStep
                    data={stepData.CONTACT_LOCALE as Record<string, string>}
                    onChange={updateField}
                  />
                )}
                {currentStep.key === 'PLAN_SELECTION' && (
                  <PlanSelectionStep
                    plans={plans}
                    selectedSlug={selectedPlanSlug}
                    onSelect={(slug) => updateField('planSlug', slug)}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Error */}
            {error && (
              <div className="mt-5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-7 pt-5 border-t border-border">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentIdx === 0 || isSubmitting}
                className="gap-2"
                id="ob-back-btn"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <Button
                onClick={handleNext}
                disabled={isSubmitting}
                className="gap-2 px-6"
                id="ob-next-btn"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : currentIdx < STEPS.length - 1 ? (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : selectedPlan && selectedPlan.price > 0 ? (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Continue to Payment
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Let's go!
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Skip link */}
        <div className="text-center mt-5">
          <button
            type="button"
            onClick={async () => {
              try {
                await completeOnboarding.mutateAsync();
                router.replace('/org');
              } catch {
                router.replace('/org');
              }
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            id="ob-skip-btn"
          >
            Skip setup for now
          </button>
        </div>
      </div>
    </div>
  );
}
