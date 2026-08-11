// Ambassador Program — shared types, matching the API reference doc byte-for-byte
// (base path /api/v1, see chat-provided "Ambassador Program — API Reference").

export type ApplicationFieldType = "TEXT" | "EMAIL" | "PHONE" | "NUMBER" | "SELECT" | "DATE";

export interface ApplicationFieldDef {
  key: string;
  label: string;
  type: ApplicationFieldType;
  required: boolean;
  options?: string[]; // only meaningful when type === "SELECT"
}

export interface AmbassadorTypeDefinition {
  key: string;
  label: string;
  proofFieldLabel: string;
  applicationFields: ApplicationFieldDef[];
}

export type AmbassadorStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

/** AmbassadorResult — returned by apply/me/applications endpoints. */
export interface Ambassador {
  id: string;
  organizationId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string | null;
  ambassadorType: string;
  applicationData: Record<string, string>;
  status: AmbassadorStatus;
  proofUrl: string;
  appliedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export type AmbassadorCampaignStatus = "ACTIVE" | "ARCHIVED";

export interface MilestoneTier {
  label?: string; // admin-facing tier name, e.g. "Level 1"
  minRegistrations: number;
  maxRegistrations: number | null; // null = uncapped top tier
  rewardType: "PER_REGISTRATION" | "FLAT_PLUS_PER_REG";
  amountPerRegistration: number; // paise
  goodie?: { label: string; cashEquivalent?: number };
}

export interface SpeedBonusTier {
  withinDays: number;
  bonusAmount: number; // paise
  label: string;
  goodie?: { label: string; cashEquivalent?: number };
}

export interface SpeedBonusConfig {
  enabled: boolean;
  campaignStartAt: string; // ISO
  milestoneThreshold: number;
  tiers: SpeedBonusTier[]; // min 1 item
}

export type LeaderboardScope =
  | "INDIVIDUAL_AMBASSADOR"
  | "DEPARTMENT"
  | "INTER_COLLEGE_DEPARTMENT"
  | "COLLEGE";

export const LEADERBOARD_SCOPES: LeaderboardScope[] = [
  "INDIVIDUAL_AMBASSADOR",
  "DEPARTMENT",
  "INTER_COLLEGE_DEPARTMENT",
  "COLLEGE",
];

export interface LeaderboardRankReward {
  rank?: number;
  rankRange?: [number, number];
  cashAmount?: number;
  goodie?: { label: string; cashEquivalent?: number };
  label?: string;
}

export interface LeaderboardCut {
  scope: LeaderboardScope;
  label: string;
  // Accepted by the schema but not implemented server-side yet — leaderboards
  // always rank by raw registration count for now.
  rankedBy?: "REGISTRATION_RATE_PERCENT";
  winnerCount?: number;
  ranks: LeaderboardRankReward[];
  consolation?: { label: string; cashAmount: number };
}

export interface RewardConfig {
  currency: string;
  amountsInPaise: true;
  milestoneTiers: MilestoneTier[];
  speedBonus?: SpeedBonusConfig;
  leaderboardPrizes: LeaderboardCut[];
}

export interface ShareTemplates {
  whatsappText?: string;
  instagramText?: string;
  posterImageUrl?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Ambassador-authenticated (/api/v1/ambassador) ──────────────────────────

export interface AvailableCampaignItem {
  id: string;
  name: string;
  contestId: string;
  contestSlug: string;
  contestTitle: string;
  ambassadorTypesAllowed: string[];
}

export interface CampaignStatsProgress {
  current: number;
  required: number;
}

export interface CampaignSpeedBonusStatus {
  earned: boolean;
  tier: SpeedBonusTier | null;
  daysToMilestone: number | null;
}

/** Populated (non-empty) only when read from GET /ambassador/campaigns/:id/stats — always [] on the "mine" list. */
export interface LeaderboardRankEntry {
  scope: LeaderboardScope;
  label: string;
  rank: number | null;
}

export interface CampaignStats {
  registrationCount: number;
  currentTier: MilestoneTier | null;
  nextTier: MilestoneTier | null;
  progressToNextTier: CampaignStatsProgress | null;
  accruedAmount: number; // paise
  speedBonus: CampaignSpeedBonusStatus | null;
  leaderboardRanks: LeaderboardRankEntry[];
}

export interface MyCampaignItem {
  enrollmentId: string;
  campaignId: string;
  name: string;
  contestId: string;
  contestSlug: string;
  contestTitle: string;
  referralCode: string;
  shareTemplates: ShareTemplates;
  stats: CampaignStats;
}

/** Nested `campaign` field on GET /ambassador/campaigns/:campaignId/stats — no contestTitle here, unlike MyCampaignItem. */
export interface StatsCampaignSummary {
  id: string;
  name: string;
  contestId: string;
  contestSlug: string;
  referralCode: string;
  ambassadorTypesAllowed: string[];
  shareTemplates: ShareTemplates;
}

export interface CampaignStatsDetail extends CampaignStats {
  campaign: StatsCampaignSummary;
}

export interface EnrollmentResult {
  id: string;
  campaignId: string;
  ambassadorId: string;
  referralCode: string;
  createdAt: string;
}

export interface LeaderboardEntryResult {
  rank: number;
  groupKey: string;
  label: string;
  registrationCount: number;
  prize: LeaderboardRankReward | null;
}

// ── Org-admin (/api/v1/org/ambassadors) ─────────────────────────────────────

export interface CampaignListItem {
  id: string;
  name: string;
  contestId: string;
  contestTitle: string;
  status: AmbassadorCampaignStatus;
  ambassadorTypesAllowed: string[];
  enrollmentCount: number;
  createdAt: string;
}

export interface CampaignResult {
  id: string;
  organizationId: string;
  contestId: string;
  name: string;
  ambassadorTypesAllowed: string[];
  rewardConfig: RewardConfig;
  shareTemplates: ShareTemplates;
  sourceCampaignId: string | null;
  status: AmbassadorCampaignStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationReportRow {
  ambassadorId: string;
  firstName: string;
  lastName: string | null;
  email: string;
  registrationCount: number;
  currentTierLabel: string | null;
  accruedAmount: number; // paise
  createdAt: string;
}
