'use client';

/**
 * Onboarding Hooks
 *
 * TanStack Query wrappers over the 4 onboarding API endpoints.
 * Pattern matches useOrganization.ts in this same directory.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import * as onboardingApi from '../api/onboarding.api';
import { queryKeys } from '../api/queryClient';

/**
 * Reads the current onboarding status for the active org.
 * Disabled when `enabled` is false (e.g. while auth is loading).
 */
export function useOnboardingStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.onboarding.status,
    queryFn:  onboardingApi.getOnboardingStatus,
    enabled,
    retry: false,
    staleTime: 0, // always fresh — the wizard mutates this often
  });
}

/**
 * Returns available plans (static Free stub for now).
 */
export function useOnboardingPlans(enabled = true) {
  return useQuery({
    queryKey: queryKeys.onboarding.plans,
    queryFn:  onboardingApi.getOnboardingPlans,
    enabled,
    staleTime: 60_000, // plans don't change often
  });
}

/**
 * Saves one wizard step.
 * Invalidates status after success so the wizard re-reads `currentStep`.
 */
export function useSaveOnboardingStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ step, data }: { step: string; data: Record<string, unknown> }) =>
      onboardingApi.saveOnboardingStep(step, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.status });
    },
  });
}

/**
 * Marks the wizard as fully completed.
 * Invalidates status so the layout gate stops redirecting.
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: onboardingApi.completeOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.status });
    },
  });
}
