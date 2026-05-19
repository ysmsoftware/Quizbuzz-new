// ============================================
// Public Contest Types — matches server response shape
// from GET /contests/public and GET /contests/public/:slug
// ============================================

export type PublicContestStatus =
  | 'PUBLISHED'
  | 'REGISTRATION_CLOSED'
  | 'LIVE'
  | 'EVALUATION'
  | 'RESULTS_OUT'
  | 'COMPLETED';

export interface PublicContestPrize {
  id: string;
  rankFrom: number;
  rankTo: number;
  amount: number | string;
  currency: string;
  label: string | null;
  benefits: string[];
}

export interface PublicContestPaymentConfig {
  amount: number;       // in ₹ (not paise)
  currency: string;
  description?: string;
}

/**
 * Shape returned by GET /contests/public (list endpoint).
 * Has a subset of fields compared to the detail endpoint.
 */
export interface PublicContestSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  topics: string[];
  status: PublicContestStatus;
  startTime: string;               // ISO date
  registrationDeadline: string;    // ISO date
  duration: number;                // minutes
  maxParticipants: number | null;
  cutoffScore: number | null;
  paymentEnabled: boolean;
  paymentConfig: PublicContestPaymentConfig | null;
  showResultsAfter: number;
  prizes: PublicContestPrize[];
  _count: {
    participants: number;
    questions: number;
  };
}

/**
 * Shape returned by GET /contests/public/:slug (detail endpoint).
 * Includes additional fields like details, rules, organization info.
 */
export interface PublicContestDetail extends PublicContestSummary {
  details: string | null;          // rich text / markdown
  rules: string[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  createdAt: string;
  organization?: {
    name: string;
    logoUrl: string | null;
  };
}

/**
 * Registration response from POST /contests/register/:contestSlug
 */
export interface RegistrationResult {
  registrationRef: string;
  participantId: string;
  paymentRequired: boolean;
  status: string;
  payment?: {
    amount: number;
    currency: string;
    description: string;
  };
}
