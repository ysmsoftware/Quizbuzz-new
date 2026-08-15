import { Ambassador, AmbassadorStatus } from "@prisma/client";
import { AmbassadorCampaignRepository } from "./ambassador-campaign.repository";
import { computeFullReward } from "./reward-calculator";
import { LeaderboardCut, LeaderboardScope, RewardConfig, SpeedBonusResult } from "./ambassador-campaign.types";

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

    return [...groups.values()].sort((a, b) => b.registrationCount - a.registrationCount);
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
