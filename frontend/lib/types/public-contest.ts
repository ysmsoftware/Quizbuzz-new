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
  bannerImage?: string | null;
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
  /** Same value as _count.questions, exposed under the name the pre-quiz flow reads. */
  totalQuestions: number;
  /** Sum of ContestQuestion.marks across all questions assigned to this contest. */
  totalMarks: number;
  /** Sum of ContestQuestion.negativeMark across all questions — 0 means no
   *  negative marking anywhere in this contest. Divide by totalQuestions for
   *  a per-question average, same approach as totalMarks/totalQuestions. */
  totalNegativeMarks: number;
  /**
   * Server clock (ISO) at response time. Clients should anchor countdowns to this
   * rather than to their own clock, since the quiz starts on the server's schedule.
   * Only meaningful on an uncached read — see getContestBySlug({ fresh: true }).
   */
  serverTime: string;
  /** Present only when the request included a valid, approved, live ?ref= referral code —
   *  used to render a campaign-specific WhatsApp/social link-preview card (poster image +
   *  campaign name + the referring ambassador's first name) instead of the generic site
   *  default. Null/absent for a normal visit or an unrecognized/expired code. */
  referralPreview?: {
    campaignName: string;
    posterImageUrl?: string | null;
    ambassadorFirstName: string;
  } | null;
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
  // The email/phone this registration actually landed on — may differ from
  // what was typed if an existing contact was matched by phone under an
  // older email. See registration audit, issue A.
  contactEmail?: string;
  contactPhone?: string;
}
