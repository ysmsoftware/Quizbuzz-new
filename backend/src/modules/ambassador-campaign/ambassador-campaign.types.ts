import { AmbassadorCampaignStatus } from "@prisma/client";

// ─── Reward config — the Open/Closed point of this module (§6.4) ──────────────
// The service must walk milestoneTiers/leaderboardPrizes generically and never
// special-case a specific tier count, scope value, or reward number.

export interface RewardConfig {
    currency: string;
    amountsInPaise: true;
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
    campaignStartAt: string; // ISO
    milestoneThreshold: number;
    tiers: {
        withinDays: number;
        bonusAmount: number;
        label: string;
        goodie?: { label: string; cashEquivalent?: number | undefined } | undefined;
    }[];
}

export type LeaderboardScope = "INDIVIDUAL_AMBASSADOR" | "DEPARTMENT" | "INTER_COLLEGE_DEPARTMENT" | "COLLEGE";

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

export interface ShareTemplates {
    whatsappText?: string | undefined;
    instagramText?: string | undefined;
    posterImageUrl?: string | undefined;
}

// ─── DTOs (controller → service) ───────────────────────────────────────────────

export interface CreateCampaignDTO {
    contestId: string;
    name: string;
    ambassadorTypesAllowed: string[];
    rewardConfig: RewardConfig;
    shareTemplates?: ShareTemplates | undefined;
}

export interface UpdateCampaignDTO {
    name?: string | undefined;
    ambassadorTypesAllowed?: string[] | undefined;
    rewardConfig?: RewardConfig | undefined;
    shareTemplates?: ShareTemplates | undefined;
    status?: AmbassadorCampaignStatus | undefined;
}

export interface DuplicateCampaignDTO {
    contestId: string;
}

export interface ListCampaignsQueryDTO {
    status?: AmbassadorCampaignStatus | undefined;
    page: number;
    limit: number;
    sortBy: "createdAt" | "name";
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
    contestId: string;
    name: string;
    ambassadorTypesAllowed: string[];
    rewardConfig: RewardConfig;
    shareTemplates: ShareTemplates;
    sourceCampaignId: string | null;
    status: AmbassadorCampaignStatus;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CampaignListItem {
    id: string;
    name: string;
    contestId: string;
    contestTitle: string;
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
    createdAt: Date;
}

export interface AvailableCampaignItem {
    id: string;
    name: string;
    contestId: string;
    contestSlug: string;
    contestTitle: string;
    ambassadorTypesAllowed: string[];
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

export interface LeaderboardEntryResult {
    rank: number;
    groupKey: string;
    label: string;
    registrationCount: number;
    prize: LeaderboardCut["ranks"][number] | null;
}
