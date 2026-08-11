import { Ambassador } from "@prisma/client";
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
    if (rewardConfig.speedBonus?.enabled && registrationCount >= rewardConfig.speedBonus.milestoneThreshold) {
        thresholdReachedAt = await campaignRepo.findNthReferralCreatedAt(
            enrollmentId,
            rewardConfig.speedBonus.milestoneThreshold,
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
 * ponytail: DEPARTMENT/COLLEGE/INTER_COLLEGE_DEPARTMENT group by reading
 * conventional 'college'/'department' keys out of Ambassador.applicationData
 * (there's no dedicated column — an org whose type uses different field keys
 * falls into "Unknown"). rankedBy: "REGISTRATION_RATE_PERCENT" is not
 * computed (no denominator exists anywhere in the schema, e.g. audience
 * size) — every scope ranks by raw registrationCount. Upgrade path: once a
 * denominator field exists on the ambassador type or campaign, rank by rate
 * here instead.
 */
function groupKeyAndLabel(scope: LeaderboardScope, ambassador: Ambassador): { key: string; label: string } {
    const data = (ambassador.applicationData ?? {}) as Record<string, unknown>;
    const college = String(data.college ?? "Unknown");
    const department = String(data.department ?? "Unknown");

    switch (scope) {
        case "INDIVIDUAL_AMBASSADOR":
            return { key: ambassador.id, label: `${ambassador.firstName} ${ambassador.lastName ?? ""}`.trim() };
        case "COLLEGE":
            return { key: college, label: college };
        case "DEPARTMENT":
            return { key: department, label: department };
        case "INTER_COLLEGE_DEPARTMENT":
            return { key: `${college}::${department}`, label: `${college} / ${department}` };
    }
}

/** Ranked groups for a campaign + scope, highest registrationCount first. */
export async function computeLeaderboardGroups(
    campaignRepo: AmbassadorCampaignRepository,
    campaignId: string,
    scope: LeaderboardScope,
): Promise<LeaderboardGroup[]> {
    const enrollments = await campaignRepo.listEnrollmentsForCampaign(campaignId);
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

export function findPrizeForRank(cut: LeaderboardCut, rank: number): LeaderboardCut["ranks"][number] | null {
    const exact = cut.ranks.find((r) => r.rank === rank);
    if (exact) return exact;
    const ranged = cut.ranks.find((r) => r.rankRange && rank >= r.rankRange[0] && rank <= r.rankRange[1]);
    if (ranged) return ranged;
    if (cut.consolation) return { label: cut.consolation.label, cashAmount: cut.consolation.cashAmount };
    return null;
}
