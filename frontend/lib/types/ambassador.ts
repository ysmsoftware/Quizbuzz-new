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

export type AmbassadorCampaignStatus = "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED" | "ARCHIVED";

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
  maxWinners?: number;
  goodie?: { label: string; cashEquivalent?: number };
}

export type SpeedBonusStartMode = 'CONTEST_START' | 'OFFSET_WEEKS' | 'CUSTOM';

export interface SpeedBonusConfig {
  enabled: boolean;
  campaignStartAt?: string; // ISO — the resolved date, always what the backend's reward math reads
  /** How campaignStartAt was computed — UX memory only, so the editor reopens on the right mode. */
  campaignStartAtMode?: SpeedBonusStartMode;
  /** Meaningful only when campaignStartAtMode === 'OFFSET_WEEKS'. */
  campaignStartAtOffsetWeeks?: number;
  milestoneThreshold?: number;
  tiers: SpeedBonusTier[]; // min 1 item
}

export type LeaderboardScopeKind = "INDIVIDUAL_AMBASSADOR" | "APPLICATION_FIELD_GROUP";

/** A campaign-defined leaderboard cut — groups by whichever `Ambassador.applicationData`
 *  field key(s) the campaign's own selected ambassador types collect, or by individual
 *  ambassador. No fixed vocabulary (no more DEPARTMENT/COLLEGE). */
export interface LeaderboardScope {
  kind: LeaderboardScopeKind;
  groupByFieldKeys?: string[];
}

/** Stable string identity for a scope — used as a React/Tabs key and, joined the same way,
 *  as the query-string encoding the backend expects (`?scope=KIND&groupByFieldKeys=a,b`). */
export function leaderboardScopeKey(scope: LeaderboardScope): string {
  return scope.groupByFieldKeys?.length ? `${scope.kind}:${scope.groupByFieldKeys.join(",")}` : scope.kind;
}

export function leaderboardScopeQueryParams(scope: LeaderboardScope): Record<string, string> {
  const params: Record<string, string> = { scope: scope.kind };
  if (scope.groupByFieldKeys?.length) params.groupByFieldKeys = scope.groupByFieldKeys.join(",");
  return params;
}

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

/** Shape while a campaign is still DRAFT — nothing is required yet. The creation wizard
 *  saves one field at a time; PublishCampaignSchema (backend) is what enforces completeness
 *  before a campaign can go LIVE. */
export type DraftRewardConfig = Partial<RewardConfig>;

/** One authored WhatsApp message template — an ambassador kit can offer several (e.g. a
 *  launch message, a deadline-reminder nudge, a leaderboard-standing brag) instead of a
 *  single fixed message. `text` supports {referralLink}/{ambassadorName}/{contestName}
 *  placeholders — see SHARE_TEMPLATE_PLACEHOLDERS in ShareTemplatesEditor.tsx. */
export interface ShareMessageTemplate {
  id: string; // client-generated (crypto.randomUUID()), stable list key only — not sent to any consumer
  label: string; // admin-facing name, e.g. "Launch announcement"
  text: string;
  includePoster: boolean; // whether this message is shared together with the poster image
}

export interface ShareTemplates {
  /** Kept in sync with whatsappTemplates[0]?.text — the "primary" message, and the only one
   *  the ambassador-facing dashboard (ShareCampaignCard, KitTab summary) reads today. Reading
   *  a single field there means the multi-template picker below can be introduced without
   *  needing dashboard changes in this pass. */
  whatsappText?: string;
  whatsappTemplates?: ShareMessageTemplate[];
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
  contestId: string | null;
  contestTitle: string | null;
  status: AmbassadorCampaignStatus;
  ambassadorTypesAllowed: string[];
  enrollmentCount: number;
  createdAt: string;
}

// ── Timeline (§3.2, §6) ──────────────────────────────────────────────────────

/** One auto-generated timeline segment — mirrors backend campaign-timeline.ts. Stored as a
 *  snapshot, so it doesn't recompute/shift once shown. */
export interface CampaignPhase {
  key: string;
  label: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
}

/** One row of the fraction-based phase breakdown — {key, label, fraction} where fractions of
 *  all rows should sum to ~1. `null` on a campaign means "use the built-in default template". */
export interface CampaignPhaseTemplateEntry {
  key: string;
  label: string;
  fraction: number;
}

export interface CampaignResult {
  id: string;
  organizationId: string;
  contestId: string | null;
  name: string;
  ambassadorTypesAllowed: string[];
  rewardConfig: DraftRewardConfig;
  shareTemplates: ShareTemplates;
  sourceCampaignId: string | null;
  status: AmbassadorCampaignStatus;
  wizardStep: number;
  startDate: string | null; // ISO
  endDate: string | null; // ISO
  phaseTemplate: CampaignPhaseTemplateEntry[] | null;
  phases: CampaignPhase[];
  publishedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ── Ambassador Structure (§3.3) ─────────────────────────────────────────────

export type AmbassadorGroupType = string;

export interface AmbassadorGroupInput {
  groupType: AmbassadorGroupType;
  name: string;
  ambassadorTarget?: number;
  registrationTarget?: number;
}

export interface AmbassadorGroupResult extends AmbassadorGroupInput {
  id: string;
  campaignId: string;
  createdAt: string;
}

export interface CampaignCapacity {
  groupCount: number;
  totalAmbassadorTarget: number;
  totalRegistrationTarget: number;
}

// ── Campaign Templates (§3.4, Phase 5) ──────────────────────────────────────

export interface CampaignTemplate {
  id: string;
  organizationId: string;
  name: string;
  ambassadorTypesAllowed: string[];
  rewardConfig: DraftRewardConfig;
  shareTemplates: ShareTemplates;
  groups: AmbassadorGroupInput[];
  sourceCampaignId: string | null;
  createdById: string;
  createdAt: string;
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
