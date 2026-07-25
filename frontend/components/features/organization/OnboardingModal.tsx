'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Country, State, City } from 'country-state-city';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  useOnboardingStatus,
  useSaveOnboardingStep,
  useCompleteOnboarding,
} from '@/lib/hooks/useOnboarding';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChipSelect } from '@/components/shared/ChipSelect';
import { Combobox } from '@/components/shared/Combobox';
import {
  USE_CASES,
  ORG_SIZES,
  CONTEST_VOLUMES,
  PARTICIPANT_VOLUMES,
  HEARD_SOURCES,
} from '@/lib/constants/org-profile-options';
import { cn } from '@/lib/utils';
import {
  Building2,
  Target,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Heart,
} from 'lucide-react';

const STEPS = [
  { key: 'IDENTITY', label: 'Organization Name', icon: Building2 },
  { key: 'USE_CASE', label: 'What You Do', icon: Target },
  { key: 'CONTACT_LOCALE', label: 'Contact & Region', icon: MapPin },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

interface OnboardingModalProps {
  open: boolean;
  onComplete?: () => void;
  onTriggerUpgradePrompt?: () => void;
}

export function OnboardingModal({ open, onComplete, onTriggerUpgradePrompt }: OnboardingModalProps) {
  const { admin, activeOrg, meQuery, isLoggedIn, isEmailVerified } = useAuth();
  const ready = !meQuery.isLoading && isLoggedIn && isEmailVerified;
  const onboardingQuery = useOnboardingStatus(ready && open);
  const saveStepMutation = useSaveOnboardingStep();
  const completeOnboarding = useCompleteOnboarding();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Step Data state
  const [identityData, setIdentityData] = useState({ name: '' });
  const [useCaseData, setUseCaseData] = useState<Record<string, unknown>>({
    primaryUseCase: '',
    useCaseOther: '',
    sizeBucket: '',
    expectedContestsPerMonth: 'UNSURE',
    expectedParticipants: 'UNSURE',
  });
  const [contactData, setContactData] = useState<Record<string, unknown>>({
    primaryContactName: '',
    primaryContactEmail: '',
    primaryContactPhone: '',
    country: '',
    state: '',
    city: '',
    timezone: '',
    heardAboutSource: '',
    heardAboutOther: '',
    marketingOptIn: false,
  });

  // Country, state, city cascading ISO state
  const [selectedCountryIso, setSelectedCountryIso] = useState<string>('');
  const [selectedStateIso, setSelectedStateIso] = useState<string>('');

  // Prefill default name & email from auth
  useEffect(() => {
    if (activeOrg?.name && !identityData.name) {
      setIdentityData({ name: activeOrg.name });
    } else if (admin?.firstName && !identityData.name) {
      setIdentityData({ name: `${admin.firstName}'s Organization` });
    }

    if (admin) {
      const fullName = `${admin.firstName || ''} ${admin.lastName || ''}`.trim();
      setContactData((prev) => ({
        ...prev,
        primaryContactName: prev.primaryContactName || fullName || 'Org Admin',
        primaryContactEmail: prev.primaryContactEmail || admin.email || '',
        timezone: prev.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      }));
    }
  }, [admin, activeOrg]);

  // Sync server profile state when loaded
  useEffect(() => {
    if (onboardingQuery.data?.data) {
      const serverStep = onboardingQuery.data.data.currentStep;
      const idx = STEPS.findIndex((s) => s.key === serverStep);
      if (idx >= 0) setCurrentIdx(idx);

      const profile = onboardingQuery.data.data.profile;
      if (profile) {
        setUseCaseData({
          primaryUseCase: profile.primaryUseCase ?? '',
          useCaseOther: profile.useCaseOther ?? '',
          sizeBucket: profile.sizeBucket ?? '',
          expectedContestsPerMonth: profile.expectedContestsPerMonth ?? 'UNSURE',
          expectedParticipants: profile.expectedParticipants ?? 'UNSURE',
        });
        setContactData((prev) => ({
          ...prev,
          primaryContactName: profile.primaryContactName || prev.primaryContactName,
          primaryContactPhone: profile.primaryContactPhone ?? '',
          primaryContactEmail: profile.primaryContactEmail || prev.primaryContactEmail,
          country: profile.country ?? '',
          state: profile.state ?? '',
          city: profile.city ?? '',
          timezone: profile.timezone || prev.timezone,
          heardAboutSource: profile.heardAboutSource ?? '',
          heardAboutOther: profile.heardAboutOther ?? '',
          marketingOptIn: profile.marketingOptIn ?? false,
        }));
      }
    }
  }, [onboardingQuery.data]);

  // Country / State / City lookup tables
  const countryOptions = useMemo(() => {
    return Country.getAllCountries().map((c) => ({
      label: c.name,
      value: c.name,
      isoCode: c.isoCode,
    }));
  }, []);

  useEffect(() => {
    if (contactData.country) {
      const found = countryOptions.find((c) => c.value.toLowerCase() === String(contactData.country).toLowerCase());
      if (found) setSelectedCountryIso(found.isoCode);
    }
  }, [contactData.country, countryOptions]);

  const stateOptions = useMemo(() => {
    if (!selectedCountryIso) return [];
    return State.getStatesOfCountry(selectedCountryIso).map((s) => ({
      label: s.name,
      value: s.name,
      isoCode: s.isoCode,
    }));
  }, [selectedCountryIso]);

  useEffect(() => {
    if (contactData.state && selectedCountryIso) {
      const found = stateOptions.find((s) => s.value.toLowerCase() === String(contactData.state).toLowerCase());
      if (found) setSelectedStateIso(found.isoCode);
    }
  }, [contactData.state, selectedCountryIso, stateOptions]);

  const cityOptions = useMemo(() => {
    if (!selectedCountryIso || !selectedStateIso) return [];
    return City.getCitiesOfState(selectedCountryIso, selectedStateIso).map((c) => ({
      label: c.name,
      value: c.name,
    }));
  }, [selectedCountryIso, selectedStateIso]);

  const currentStep = STEPS[currentIdx] || STEPS[0];
  const StepIcon = currentStep.icon;
  const isSubmitting = saveStepMutation.isPending || completeOnboarding.isPending;

  const handleNext = async () => {
    setError(null);
    try {
      if (currentStep.key === 'IDENTITY') {
        if (!identityData.name.trim()) {
          setError('Organization name is required');
          return;
        }
        await saveStepMutation.mutateAsync({
          step: 'IDENTITY',
          data: { name: identityData.name.trim() },
        });
        await meQuery.refetch();
        setCurrentIdx(1);
      } else if (currentStep.key === 'USE_CASE') {
        await saveStepMutation.mutateAsync({
          step: 'USE_CASE',
          data: useCaseData,
        });
        setCurrentIdx(2);
      } else if (currentStep.key === 'CONTACT_LOCALE') {
        await saveStepMutation.mutateAsync({
          step: 'CONTACT_LOCALE',
          data: contactData,
        });
        await completeOnboarding.mutateAsync();
        if (onComplete) onComplete();
        if (onTriggerUpgradePrompt) onTriggerUpgradePrompt();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save onboarding step. Please try again.');
    }
  };

  const handleBack = () => {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
  };

  const handleSkip = async () => {
    try {
      await completeOnboarding.mutateAsync();
      if (onComplete) onComplete();
      if (onTriggerUpgradePrompt) onTriggerUpgradePrompt();
    } catch {
      if (onComplete) onComplete();
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-xl p-0 overflow-hidden border-border bg-card shadow-2xl">
        {/* Accent Bar */}
        <div className="h-1.5 bg-gradient-to-r from-primary via-primary/80 to-accent" />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              Welcome to QuizBuzz
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Let's customize your workspace — step {currentIdx + 1} of {STEPS.length}
            </DialogDescription>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i < currentIdx
                    ? 'w-8 bg-primary'
                    : i === currentIdx
                    ? 'w-8 bg-primary'
                    : 'w-2.5 bg-muted'
                )}
              />
            ))}
          </div>

          {/* Step Header Badge */}
          <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-secondary/50 border border-border/50">
            <div className="p-2 rounded-md bg-primary/10 border border-primary/20 shrink-0 text-primary">
              <StepIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">
                Step {currentIdx + 1} of {STEPS.length}
              </p>
              <h3 className="text-base font-semibold leading-snug">{currentStep.label}</h3>
            </div>
          </div>

          {/* Animated Step Form Body */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.key}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {currentStep.key === 'IDENTITY' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ob-modal-org-name" className="text-sm font-medium">
                      Organization Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="ob-modal-org-name"
                      placeholder="e.g. Acme Institute, Tech Club"
                      value={identityData.name}
                      onChange={(e) => setIdentityData({ name: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This will be displayed across your contest portals, certificates, and team dashboard.
                  </p>
                </div>
              )}

              {currentStep.key === 'USE_CASE' && (
                <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
                  <div className="space-y-2">
                    <Label>What best describes your organization?</Label>
                    <ChipSelect
                      options={USE_CASES as any}
                      value={(useCaseData.primaryUseCase as string) || null}
                      onChange={(v) => setUseCaseData((prev) => ({ ...prev, primaryUseCase: v }))}
                    />
                    {useCaseData.primaryUseCase === 'OTHER' && (
                      <Input
                        placeholder="Describe your use case…"
                        value={(useCaseData.useCaseOther as string) || ''}
                        onChange={(e) =>
                          setUseCaseData((prev) => ({ ...prev, useCaseOther: e.target.value }))
                        }
                        className="mt-2"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Organization size</Label>
                    <ChipSelect
                      options={ORG_SIZES as any}
                      value={(useCaseData.sizeBucket as string) || null}
                      onChange={(v) => setUseCaseData((prev) => ({ ...prev, sizeBucket: v }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contests per month</Label>
                      <ChipSelect
                        options={CONTEST_VOLUMES as any}
                        value={(useCaseData.expectedContestsPerMonth as string) || 'UNSURE'}
                        onChange={(v) =>
                          setUseCaseData((prev) => ({ ...prev, expectedContestsPerMonth: v }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Participants per contest</Label>
                      <ChipSelect
                        options={PARTICIPANT_VOLUMES as any}
                        value={(useCaseData.expectedParticipants as string) || 'UNSURE'}
                        onChange={(v) =>
                          setUseCaseData((prev) => ({ ...prev, expectedParticipants: v }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep.key === 'CONTACT_LOCALE' && (
                <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ob-m-contact-name">Contact Name</Label>
                      <Input
                        id="ob-m-contact-name"
                        placeholder="Jane Smith"
                        value={(contactData.primaryContactName as string) || ''}
                        onChange={(e) =>
                          setContactData((prev) => ({ ...prev, primaryContactName: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ob-m-contact-email">Contact Email</Label>
                      <Input
                        id="ob-m-contact-email"
                        type="email"
                        placeholder="jane@yourorg.com"
                        value={(contactData.primaryContactEmail as string) || ''}
                        onChange={(e) =>
                          setContactData((prev) => ({ ...prev, primaryContactEmail: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="ob-m-contact-phone">Contact Phone</Label>
                      <Input
                        id="ob-m-contact-phone"
                        placeholder="+91 98765 43210"
                        value={(contactData.primaryContactPhone as string) || ''}
                        onChange={(e) =>
                          setContactData((prev) => ({ ...prev, primaryContactPhone: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Country</Label>
                      <Combobox
                        options={countryOptions}
                        value={(contactData.country as string) || ''}
                        placeholder="Select country..."
                        searchPlaceholder="Search country..."
                        onChange={(val) => {
                          const found = countryOptions.find((c) => c.value === val);
                          setSelectedCountryIso(found?.isoCode || '');
                          setSelectedStateIso('');
                          setContactData((prev) => ({
                            ...prev,
                            country: val,
                            state: '',
                            city: '',
                          }));
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>State / Region</Label>
                      <Combobox
                        options={stateOptions}
                        value={(contactData.state as string) || ''}
                        placeholder={selectedCountryIso ? 'Select state...' : 'Select country first'}
                        searchPlaceholder="Search state..."
                        disabled={!selectedCountryIso}
                        onChange={(val) => {
                          const found = stateOptions.find((s) => s.value === val);
                          setSelectedStateIso(found?.isoCode || '');
                          setContactData((prev) => ({ ...prev, state: val, city: '' }));
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>City</Label>
                      <Combobox
                        options={cityOptions}
                        value={(contactData.city as string) || ''}
                        placeholder={selectedStateIso ? 'Select city...' : 'Select state first'}
                        searchPlaceholder="Search city..."
                        disabled={!selectedStateIso}
                        onChange={(val) => setContactData((prev) => ({ ...prev, city: val }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>How did you hear about QuizBuzz?</Label>
                    <ChipSelect
                      options={HEARD_SOURCES as any}
                      value={(contactData.heardAboutSource as string) || null}
                      onChange={(v) =>
                        setContactData((prev) => ({ ...prev, heardAboutSource: v }))
                      }
                    />
                    {contactData.heardAboutSource === 'OTHER' && (
                      <Input
                        placeholder="Tell us more…"
                        value={(contactData.heardAboutOther as string) || ''}
                        onChange={(e) =>
                          setContactData((prev) => ({ ...prev, heardAboutOther: e.target.value }))
                        }
                        className="mt-1.5"
                      />
                    )}
                  </div>

                  {/* Marketing opt-in */}
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-secondary/40">
                    <Heart className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">Stay in the loop</p>
                      <p className="text-[11px] text-muted-foreground">
                        Product updates, tips, and feature announcements
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setContactData((prev) => ({ ...prev, marketingOptIn: !prev.marketingOptIn }))
                      }
                      aria-label="Toggle marketing updates"
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                        contactData.marketingOptIn ? 'bg-primary' : 'bg-muted'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out',
                          contactData.marketingOptIn ? 'translate-x-4' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Error notice */}
          {error && (
            <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              disabled={currentIdx === 0 || isSubmitting}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <Button
              onClick={handleNext}
              disabled={isSubmitting}
              size="sm"
              className="gap-2 px-5"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : currentIdx < STEPS.length - 1 ? (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Finish Setup
                </>
              )}
            </Button>
          </div>

          {/* Skip link */}
          <div className="text-center mt-3">
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Skip setup for now
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
