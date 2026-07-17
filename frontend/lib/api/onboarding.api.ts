/**
 * Onboarding API Functions
 *
 * Covers the 4 endpoints under /onboarding:
 *   GET  /onboarding/status
 *   PATCH /onboarding/step/:step
 *   POST /onboarding/complete
 *   GET  /onboarding/plans
 */

import { get, patch, post } from './apiClient';
import type { ApiResponse } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingProfile {
  primaryUseCase:           string | null;
  useCaseOther:             string | null;
  sizeBucket:               string | null;
  expectedContestsPerMonth: string;
  expectedParticipants:     string;
  heardAboutSource:         string | null;
  heardAboutOther:          string | null;
  primaryContactName:       string | null;
  primaryContactPhone:      string | null;
  primaryContactEmail:      string | null;
  country:                  string | null;
  state:                    string | null;
  city:                     string | null;
  timezone:                 string | null;
  preferredCurrency:        string;
  gstNumber:                string | null;
  billingAddress:           string | null;
  marketingOptIn:           boolean;
}

export interface OnboardingStatus {
  completed:   boolean;
  currentStep: string;
  profile:     OnboardingProfile | null;
}

export interface PlanOption {
  slug:        string;
  name:        string;
  description: string;
  price:       number;
  currency:    string;
  features:    string[];
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * GET /onboarding/status
 * Returns completed flag, current wizard step, and accumulated profile data.
 */
export async function getOnboardingStatus(): Promise<ApiResponse<OnboardingStatus>> {
  return get<OnboardingStatus>('/onboarding/status');
}

/**
 * PATCH /onboarding/step/:step
 * Saves one wizard step's data. Idempotent.
 */
export async function saveOnboardingStep(
  step: string,
  data: Record<string, unknown>,
): Promise<ApiResponse> {
  return patch(`/onboarding/step/${step}`, data);
}

/**
 * POST /onboarding/complete
 * Marks the onboarding wizard as finished.
 */
export async function completeOnboarding(): Promise<ApiResponse> {
  return post('/onboarding/complete', {});
}

/**
 * GET /onboarding/plans
 * Returns available plan options (currently static Free only).
 */
export async function getOnboardingPlans(): Promise<ApiResponse<PlanOption[]>> {
  return get<PlanOption[]>('/onboarding/plans');
}
