import { Ambassador, AmbassadorStatus } from "@prisma/client";
import { AmbassadorCampaignRepository } from "./ambassador-campaign.repository";
import { computeFullReward, computeMilestoneReward } from "./reward-calculator";
import { paisaToRupees } from "../../utils/currency";
import { CampaignStatsSummary, LeaderboardCut, LeaderboardScope, MilestoneTier, RewardConfig, SpeedBonusResult } from "./ambassador-campaign.types";

// Same row count as "Top 5 Ambassadors" — a dashboard widget, not a paginated list.
const RECENTLY_JOINED_LIMIT = 5;

/**
 * Shared live-stats computation — the "one implementation" behind both the
 * ambassador-facing dashboard (ambassador.service.ts) and the org-admin
 * report (ambassador-campaign.service.ts). No ledger/reward table on purpose
 * (plan doc §0.4): everything here is a handful of cheap aggregate queries
 * against Participant.referredByEnrollmentId, run at read time.
 */

export interface EnrollmentStats {
    registrationCount: number;
    currentTier: RewardConfig["milestoneTiers"][number] | null;
    nextTier: RewardConfig["milestoneTiers"][number] | null;
    progressToNextTier: { current: number; required: number } | null;
    accruedAmount: number;
    speedBonus: SpeedBonusResult | null;
}

export async function computeEnrollmentStats(
    campaignRepo: AmbassadorCampaignRepository,
    enrollmentId: string,
    rewardConfig: RewardConfig,
): Promise<EnrollmentStats> {
    const registrationCount = await campaignRepo.countReferrals(enrollmentId);

    let thresholdReachedAt: Date | null = null;
    const threshold = rewardConfig.speedBonus?.milestoneThreshold;
    if (rewardConfig.speedBonus?.enabled && threshold !== undefined && registrationCount >= threshold) {
        thresholdReachedAt = await campaignRepo.findNthReferralCreatedAt(
            enrollmentId,
            threshold,
        );
    }

    const reward = computeFullReward(rewardConfig, registrationCount, thresholdReachedAt);

    return {
        registrationCount,
        currentTier: reward.currentTier,
        nextTier: reward.nextTier,
        progressToNextTier: reward.progressToNextTier,
        accruedAmount: reward.totalAccrued,
        speedBonus: reward.speedBonus,
    };
}

export interface LeaderboardGroup {
    groupKey: string;
    label: string;
    registrationCount: number;
    ambassadorIds: string[];
}

/**
 * ponytail: rankedBy: "REGISTRATION_RATE_PERCENT" is not computed (no
 * denominator exists anywhere in the schema, e.g. audience size) — every
 * scope ranks by raw registrationCount. Upgrade path: once a denominator
 * field exists on the ambassador type or campaign, rank by rate here instead.
 */
function groupKeyAndLabel(scope: LeaderboardScope, ambassador: Ambassador): { key: string; label: string } {
    if (scope.kind === "INDIVIDUAL_AMBASSADOR") {
        return { key: ambassador.id, label: `${ambassador.firstName} ${ambassador.lastName ?? ""}`.trim() };
    }

    const data = (ambassador.applicationData ?? {}) as Record<string, unknown>;
    const keys = scope.groupByFieldKeys ?? [];
    const values = keys.map((k) => String(data[k] ?? "Unknown"));

    return { key: values.join("::"), label: values.join(" / ") };
}

/** Ranked groups for a campaign + scope, highest registrationCount first. */
export async function computeLeaderboardGroups(
    campaignRepo: AmbassadorCampaignRepository,
    campaignId: string,
    scope: LeaderboardScope,
    rankedBy?: "REGISTRATION_COUNT" | "REGISTRATION_RATE_PERCENT",
): Promise<LeaderboardGroup[]> {
    // Only APPROVED applications have a live referral link (see
    // findEnrollmentByReferralCodeForContest) — PENDING/REJECTED ones would just be
    // permanent 0-count noise at the bottom of every leaderboard.
    const enrollments = (await campaignRepo.listEnrollmentsForCampaign(campaignId)).filter(
        (e) => e.status === AmbassadorStatus.APPROVED,
    );
    const counts = await campaignRepo.countReferralsForEnrollments(enrollments.map((e) => e.id));

    const groups = new Map<string, LeaderboardGroup>();
    for (const enrollment of enrollments) {
        const count = counts.get(enrollment.id) ?? 0;
        const { key, label } = groupKeyAndLabel(scope, enrollment.ambassador);
        const existing = groups.get(key);
        if (existing) {
            existing.registrationCount += count;
            existing.ambassadorIds.push(enrollment.ambassadorId);
        } else {
            groups.set(key, { groupKey: key, label, registrationCount: count, ambassadorIds: [enrollment.ambassadorId] });
        }
    }

    const sortedGroups = [...groups.values()];

    if (rankedBy === "REGISTRATION_RATE_PERCENT") {
        return sortedGroups.sort((a, b) => {
            const rateA = a.registrationCount / Math.max(1, a.ambassadorIds.length);
            const rateB = b.registrationCount / Math.max(1, b.ambassadorIds.length);
            if (rateB !== rateA) {
                return rateB - rateA;
            }
            return b.registrationCount - a.registrationCount;
        });
    }

    return sortedGroups.sort((a, b) => b.registrationCount - a.registrationCount);
}

/**
 * Structural equality for LeaderboardScope — needed because `scope` now round-trips through
 * two independent sources (a query-param parse on the request side, a JSON blob deserialize on
 * the stored-campaign side) that are never the same object reference. A `===` comparison here
 * would silently always be false once LeaderboardScope became an object instead of a string
 * literal — this is the fix for that regression. groupByFieldKeys order matters (it's meaningful
 * for the composite group key/label, e.g. ["college","department"] vs ["department","college"]
 * produce different labels), so this compares element-by-element in order, not as sets.
 */
export function leaderboardScopeEquals(a: LeaderboardScope, b: LeaderboardScope): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === "INDIVIDUAL_AMBASSADOR") return true;
    const aKeys = a.groupByFieldKeys ?? [];
    const bKeys = b.groupByFieldKeys ?? [];
    return aKeys.length === bKeys.length && aKeys.every((k, i) => k === bKeys[i]);
}

export function findPrizeForRank(cut: LeaderboardCut, rank: number): LeaderboardCut["ranks"][number] | null {
    const exact = cut.ranks.find((r) => r.rank === rank);
    if (exact) return exact;
    const ranged = cut.ranks.find((r) => r.rankRange && rank >= r.rankRange[0] && rank <= r.rankRange[1]);
    if (ranged) return ranged;
    if (cut.consolation) return { label: cut.consolation.label, cashAmount: cut.consolation.cashAmount };
    return null;
}

/**
 * Dashboard aggregate for one campaign — totals, tier distribution, and a small
 * recently-joined list, computed over EVERY approved enrollment (not a paginated report
 * page, which is capped and would silently go wrong past its page size). Shared by the
 * org-admin summary (ambassador-campaign.service.ts) and the ambassador-facing "social
 * proof" endpoint (ambassador.service.ts) — same numbers, two authorization paths.
 */
export async function computeCampaignStatsSummary(
    campaignRepo: AmbassadorCampaignRepository,
    campaignId: string,
    milestoneTiers: MilestoneTier[],
): Promise<CampaignStatsSummary> {
    const enrollments = (await campaignRepo.listEnrollmentsForCampaign(campaignId)).filter(
        (e) => e.status === AmbassadorStatus.APPROVED,
    );
    const counts = await campaignRepo.countReferralsForEnrollments(enrollments.map((e) => e.id));

    const tierCounts = milestoneTiers.map((tier) => ({
        label: tier.label ?? tier.goodie?.label ?? `${tier.minRegistrations}+`,
        count: 0,
    }));
    let noTierCount = 0;
    let totalRegistrations = 0;
    let totalAccruedAmount = 0;

    for (const enrollment of enrollments) {
        const registrationCount = counts.get(enrollment.id) ?? 0;
        totalRegistrations += registrationCount;

        const { currentTier, accruedAmount } = computeMilestoneReward(milestoneTiers, registrationCount);
        totalAccruedAmount += accruedAmount;

        const tierIndex = currentTier ? milestoneTiers.indexOf(currentTier) : -1;
        if (tierIndex >= 0) tierCounts[tierIndex]!.count++;
        else noTierCount++;
    }
    tierCounts.push({ label: "No Tier", count: noTierCount });

    const recentlyJoined = [...enrollments]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, RECENTLY_JOINED_LIMIT)
        .map((e) => ({
            ambassadorId: e.ambassadorId,
            firstName: e.ambassador.firstName,
            lastName: e.ambassador.lastName,
            createdAt: e.createdAt,
        }));

    return {
        ambassadorCount: enrollments.length,
        totalRegistrations,
        totalAccruedAmount: paisaToRupees(totalAccruedAmount),
        tierCounts,
        recentlyJoined,
    };
}

export interface DailyActivityPoint {
    date: string; // YYYY-MM-DD, oldest first
    count: number;
}

/** Buckets raw referral timestamps into daily counts for the last `days` days (today
 *  included) — zero-filled so a quiet day still renders as a bar, not a gap. */
export function bucketDailyRegistrations(timestamps: Date[], days: number): DailyActivityPoint[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        buckets.set(d.toISOString().slice(0, 10), 0);
    }

    for (const ts of timestamps) {
        const key = ts.toISOString().slice(0, 10);
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return Array.from(buckets, ([date, count]) => ({ date, count }));
}
