import { AmbassadorCampaignStatus, AmbassadorStatus } from "@prisma/client";

// ─── Reward config — the Open/Closed point of this module (§6.4) ──────────────
// The service must walk milestoneTiers/leaderboardPrizes generically and never
// special-case a specific tier count, scope value, or reward number.

export interface RewardConfig {
    currency: string;
    milestoneTiers: MilestoneTier[];
    speedBonus?: SpeedBonusConfig | undefined;
    leaderboardPrizes: LeaderboardCut[];
}

export interface MilestoneTier {
    label?: string | undefined; // admin-facing tier name, e.g. "Level 1"
    minRegistrations: number;
    maxRegistrations: number | null; // null = uncapped top tier
    rewardType: "PER_REGISTRATION" | "FLAT_PLUS_PER_REG";
    amountPerRegistration: number;
    goodie?: { label: string; cashEquivalent?: number | undefined } | undefined;
}

export interface SpeedBonusConfig {
    enabled: boolean;
    campaignStartAt?: string | undefined; // ISO — the resolved date, always what reward-calculator.ts reads
    /** UX-only memory of how the frontend computed campaignStartAt — never read by the reward
     *  math, only used so the editor shows the right mode selected when reopened. */
    campaignStartAtMode?: "CONTEST_START" | "OFFSET_WEEKS" | "CUSTOM" | undefined;
    /** Meaningful only when campaignStartAtMode === "OFFSET_WEEKS". */
    campaignStartAtOffsetWeeks?: number | undefined;
    milestoneThreshold?: number | undefined;
    tiers: {
        withinDays: number;
        bonusAmount: number;
        label: string;
        maxWinners?: number | undefined;
        goodie?: { label: string; cashEquivalent?: number | undefined } | undefined;
    }[];
}

export type LeaderboardScopeKind = "INDIVIDUAL_AMBASSADOR" | "APPLICATION_FIELD_GROUP";

export interface LeaderboardScope {
    kind: LeaderboardScopeKind;
    /** Present only when kind === "APPLICATION_FIELD_GROUP". Ordered list of
     *  Ambassador.applicationData field keys to group by — length 1 for a simple cut
     *  (e.g. ["college"]), length 2-3 for a combined/nested cut (e.g. ["college","department"]).
     *  Every key must belong to at least one applicationFields definition across the campaign's
     *  ambassadorTypesAllowed types — enforced in the service layer, not the Zod schema. */
    groupByFieldKeys?: string[] | undefined;
}

export interface LeaderboardCut {
    scope: LeaderboardScope;
    label: string;
    rankedBy?: "REGISTRATION_RATE_PERCENT" | undefined;
    winnerCount?: number | undefined;
    ranks: {
        rank?: number | undefined;
        rankRange?: [number, number] | undefined;
        cashAmount?: number | undefined;
        goodie?: { label: string; cashEquivalent?: number | undefined } | undefined;
        label?: string | undefined;
    }[];
    consolation?: { label: string; cashAmount: number } | undefined;
}

export interface ShareMessageTemplate {
    id: string;
    label: string;
    text: string;
    includePoster: boolean;
}

export interface ShareTemplates {
    whatsappText?: string | undefined;
    whatsappTemplates?: ShareMessageTemplate[] | undefined;
    instagramText?: string | undefined;
    posterImageUrl?: string | undefined;
}

/** Shape while a campaign is still DRAFT — mirrors draftRewardConfigSchema's *inferred output*
 *  exactly (not just `Partial<RewardConfig>`): milestoneTiers/leaderboardPrizes are always
 *  present (Zod `.default([])` fills them in), while currency/speedBonus stay optional.
 *  Defined this way — rather than `Partial<RewardConfig>` — so it's structurally assignable
 *  from `z.infer<typeof draftRewardConfigSchema>` under `exactOptionalPropertyTypes`. */
export interface DraftRewardConfig {
    currency?: string | undefined;
    milestoneTiers: MilestoneTier[];
    speedBonus?: SpeedBonusConfig | undefined;
    leaderboardPrizes: LeaderboardCut[];
}

// ─── Timeline (§3.2, §6) ─────────────────────────────────────────────────────

/** One segment of the auto-generated timeline preview — see campaign-timeline.ts. Stored as a
 *  snapshot in AmbassadorCampaign.phases whenever startDate/endDate change; not recomputed on
 *  every read, so a campaign's published timeline doesn't silently shift underneath a viewer. */
export interface CampaignPhase {
    key: string;
    label: string;
    startsAt: string; // ISO
    endsAt: string; // ISO
}

/** Overridable per-campaign phase breakdown — see campaign-timeline.ts's DEFAULT_PHASE_TEMPLATE.
 *  Defined here (not imported from campaign-timeline.ts) to avoid a circular import, since
 *  campaign-timeline.ts already imports CampaignPhase from this file. */
export interface CampaignPhaseTemplateEntry {
    key: string;
    label: string;
    fraction: number;
}

// ─── DTOs (controller → service) ───────────────────────────────────────────────

/** Everything but `name` is optional — a campaign starts life as an incomplete DRAFT and
 *  is filled in step by step by the creation wizard, not all at once (see PublishCampaignSchema
 *  for the fully-formed shape required before a campaign can go live). */
export interface CreateCampaignDTO {
    name: string;
    contestId?: string | undefined;
    ambassadorTypesAllowed?: string[] | undefined;
    rewardConfig?: DraftRewardConfig | undefined;
    shareTemplates?: ShareTemplates | undefined;
    startDate?: string | undefined; // ISO
    endDate?: string | undefined; // ISO
}

export interface UpdateCampaignDTO {
    name?: string | undefined;
    contestId?: string | undefined;
    ambassadorTypesAllowed?: string[] | undefined;
    rewardConfig?: DraftRewardConfig | undefined;
    shareTemplates?: ShareTemplates | undefined;
    wizardStep?: number | undefined;
    startDate?: string | undefined; // ISO
    endDate?: string | undefined; // ISO
    phaseTemplate?: CampaignPhaseTemplateEntry[] | null | undefined; // null = reset to the built-in default
}

export interface DuplicateCampaignDTO {
    contestId: string;
}

// ─── Campaign Templates (§3.4, Phase 5) ─────────────────────────────────────────

/** Saves an existing campaign's reusable config (any status) as a new template row. */
export interface CreateTemplateDTO {
    sourceCampaignId: string;
    name: string;
}

/** Creates a new DRAFT campaign pre-filled from a template. `contestId`/`name` are optional
 *  overrides — same "only what's known so far" shape as CreateCampaignDTO, since the result
 *  is still just a DRAFT the wizard can keep filling in. */
export interface InstantiateTemplateDTO {
    contestId?: string | undefined;
    name?: string | undefined;
}

export interface ListTemplatesQueryDTO {
    page: number;
    limit: number;
    sortBy: "createdAt" | "name";
    sortOrder: "asc" | "desc";
}

// ─── Ambassador Structure (§3.3) ────────────────────────────────────────────────

export type AmbassadorGroupType = string;

export interface AmbassadorGroupInput {
    groupType: AmbassadorGroupType;
    name: string;
    ambassadorTarget?: number | undefined;
    registrationTarget?: number | undefined;
}

export interface ReplaceGroupsDTO {
    groups: AmbassadorGroupInput[];
}

export interface AmbassadorGroupResult extends AmbassadorGroupInput {
    id: string;
    campaignId: string;
    createdAt: Date;
}

export interface CampaignCapacity {
    groupCount: number;
    totalAmbassadorTarget: number;
    totalRegistrationTarget: number;
}

export interface ListCampaignsQueryDTO {
    statuses?: AmbassadorCampaignStatus[] | undefined;
    ambassadorType?: string | undefined;
    q?: string | undefined;
    page: number;
    limit: number;
    sortBy: "createdAt" | "name" | "startDate" | "status";
    sortOrder: "asc" | "desc";
}

export interface ListApplicationsQueryDTO {
    statuses?: string[] | undefined;
    page: number;
    limit: number;
    sortBy: "appliedAt" | "firstName";
    sortOrder: "asc" | "desc";
}

export interface ListReportQueryDTO {
    page: number;
    limit: number;
    sortBy: "registrationCount" | "createdAt";
    sortOrder: "asc" | "desc";
}

export interface LeaderboardQueryDTO {
    scope: LeaderboardScope;
    page: number;
    limit: number;
}

// ─── Result shapes (service → controller) ──────────────────────────────────────

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
    startDate: Date | null;
    endDate: Date | null;
    phases: CampaignPhase[];
    phaseTemplate: CampaignPhaseTemplateEntry[] | null;
    publishedAt: Date | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface TemplateResult {
    id: string;
    organizationId: string;
    name: string;
    ambassadorTypesAllowed: string[];
    rewardConfig: DraftRewardConfig;
    shareTemplates: ShareTemplates;
    groups: AmbassadorGroupInput[];
    sourceCampaignId: string | null;
    createdById: string;
    createdAt: Date;
}

export interface CampaignListItem {
    id: string;
    name: string;
    contestId: string | null;
    contestTitle: string | null;
    status: AmbassadorCampaignStatus;
    ambassadorTypesAllowed: string[];
    enrollmentCount: number;
    createdAt: Date;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface CampaignStats {
    registrationCount: number;
    currentTier: MilestoneTier | null;
    nextTier: MilestoneTier | null;
    progressToNextTier: { current: number; required: number } | null;
    accruedAmount: number;
    speedBonus: SpeedBonusResult | null;
    leaderboardRanks: { scope: LeaderboardScope; label: string; rank: number | null }[];
}

export interface SpeedBonusResult {
    earned: boolean;
    tier: {
        withinDays: number;
        bonusAmount: number;
        label: string;
        goodie?: { label: string; cashEquivalent?: number | undefined } | undefined;
    } | null;
    daysToMilestone: number | null;
}

export interface EnrollmentResult {
    id: string;
    campaignId: string;
    ambassadorId: string;
    referralCode: string;
    status: AmbassadorStatus;
    createdAt: Date;
}

export interface AvailableCampaignItem {
    id: string;
    name: string;
    contestId: string;
    contestSlug: string;
    contestTitle: string;
    ambassadorTypesAllowed: string[];
    organizationName: string;
    organizationSlug: string;
}

export interface MyCampaignItem {
    enrollmentId: string;
    campaignId: string;
    name: string;
    contestId: string;
    contestSlug: string;
    contestTitle: string;
    organizationName: string;
    organizationSlug: string;
    referralCode: string;
    status: AmbassadorStatus;
    campaignStatus: AmbassadorCampaignStatus;
    rejectionReason: string | null;
    shareTemplates: ShareTemplates;
    stats: CampaignStats;
}

/**
 * An ambassador's application to a single campaign, as seen by that campaign's
 * organization — the per-campaign review unit (replaces the old org-wide "Ambassador"
 * approval). `ambassador` is the applicant's platform-level identity, reused as-is across
 * every campaign they apply to; only `status`/`reviewedAt`/`rejectionReason` are specific
 * to *this* campaign's decision.
 */
export interface ApplicationResult {
    id: string; // enrollment id
    campaignId: string;
    campaignName: string;
    ambassador: {
        id: string;
        email: string;
        phone: string | null;
        firstName: string;
        lastName: string | null;
        ambassadorType: string;
        applicationData: Record<string, unknown>;
    };
    status: AmbassadorStatus;
    appliedAt: Date;
    reviewedAt: Date | null;
    rejectionReason: string | null;
}

/**
 * Returned only by the single-campaign stats endpoint — the extra `campaign`
 * block makes that endpoint self-sufficient for a campaign detail page reached
 * directly by campaignId (no need to also fetch the paginated "mine" list just
 * to get the name/referral code/share templates). MyCampaignItem already
 * carries these fields at its own top level, so CampaignStats itself stays
 * numbers-only to avoid the duplication there.
 */
export interface CampaignStatsDetail extends CampaignStats {
    campaign: {
        id: string;
        name: string;
        contestId: string;
        contestSlug: string;
        referralCode: string;
        ambassadorTypesAllowed: string[];
        shareTemplates: ShareTemplates;
        status: AmbassadorCampaignStatus;
        startDate: Date | null;
        endDate: Date | null;
        phases: CampaignPhase[];
        milestoneTiers: MilestoneTier[];
    };
}

export interface ApplicationReportRow {
    ambassadorId: string;
    firstName: string;
    lastName: string | null;
    email: string;
    registrationCount: number;
    currentTierLabel: string | null;
    accruedAmount: number;
    createdAt: Date;
}

// ─── Campaign target (§5) ───────────────────────────────────────────────────
// Internal service-layer naming only — no schema/API change. Only variant today.
// A second variant is additive to this union whenever a concrete second case exists.
export type CampaignTarget = { type: "CONTEST"; contestId: string };

export interface LeaderboardEntryResult {
    rank: number;
    groupKey: string;
    label: string;
    registrationCount: number;
    prize: LeaderboardCut["ranks"][number] | null;
}

// ─── Campaign stats summary (org-admin dashboard aggregate) ────────────────────
// One entry per configured milestone tier (same order as rewardConfig.milestoneTiers)
// plus a trailing "No Tier" bucket for ambassadors who haven't reached the first tier yet.
export interface TierCount {
    label: string;
    count: number;
}

export interface RecentlyJoinedAmbassador {
    ambassadorId: string;
    firstName: string;
    lastName: string | null;
    createdAt: Date;
}

/** Computed as aggregate/group-by queries over ALL enrolled ambassadors — never a paginated
 *  list — so it stays correct past the report endpoint's page-size cap. */
export interface CampaignStatsSummary {
    ambassadorCount: number;
    totalRegistrations: number;
    totalAccruedAmount: number; // rupees
    tierCounts: TierCount[];
    recentlyJoined: RecentlyJoinedAmbassador[];
}
