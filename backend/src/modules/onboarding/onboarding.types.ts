import {
    OnboardingStep,
    OrgPrimaryUseCase,
    OrgSizeBucket,
    ExpectedContestVolume,
    ExpectedParticipantVolume,
    HeardAboutSource,
} from "@prisma/client";

// ─── Status DTO (GET /onboarding/status) ─────────────────────────────────────

export interface OnboardingProfileDTO {
    primaryUseCase:           OrgPrimaryUseCase | null;
    useCaseOther:             string | null;
    sizeBucket:               OrgSizeBucket | null;
    expectedContestsPerMonth: ExpectedContestVolume;
    expectedParticipants:     ExpectedParticipantVolume;
    heardAboutSource:         HeardAboutSource | null;
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

export interface OnboardingStatusDTO {
    completed:    boolean;
    currentStep:  OnboardingStep;
    profile:      OnboardingProfileDTO | null;
}

// ─── Step input types ─────────────────────────────────────────────────────────

export interface IdentityStepInput {
    name: string;
}

export interface UseCaseStepInput {
    primaryUseCase:           OrgPrimaryUseCase;
    useCaseOther?:            string;
    sizeBucket:               OrgSizeBucket;
    expectedContestsPerMonth: ExpectedContestVolume;
    expectedParticipants:     ExpectedParticipantVolume;
}

export interface AttributionStepInput {
    heardAboutSource:  HeardAboutSource;
    heardAboutOther?:  string;
    marketingOptIn?:   boolean;
}

export interface ContactLocaleStepInput {
    primaryContactName?:  string;
    primaryContactPhone?: string;
    primaryContactEmail?: string;
    country?:             string;
    state?:               string;
    city?:                string;
    timezone?:            string;
    heardAboutSource?:    HeardAboutSource;
    heardAboutOther?:     string;
    marketingOptIn?:      boolean;
}

export interface PlanSelectionStepInput {
    planSlug: string; // currently only 'free'
}

export type StepInput =
    | IdentityStepInput
    | UseCaseStepInput
    | AttributionStepInput
    | ContactLocaleStepInput
    | PlanSelectionStepInput;

// ─── Plans ──────────────────────────────────────────────────────────────────
// Shape matches the live ops billing-portal catalog response
// (GET /api/v1/billing-portal/plans in quizbuzz-ops-next) — per-cycle pricing,
// not a single flat `price`. Kept in sync with STATIC_PLANS' fallback shape.

export interface PlanOption {
    slug:          string;
    name:          string;
    description:   string;
    currency:      string;
    allowsMonthly: boolean;
    allowsAnnual:  boolean;
    monthlyPrice:  number | null;
    annualPrice:   number | null;
    features:      string[];
}
