import { MilestoneTier, RewardConfig, SpeedBonusConfig } from "./ambassador-campaign.types";
import { SpeedBonusResult } from "./ambassador-campaign.types";

/**
 * Pure reward-computation functions — the one place a future reward mechanism
 * the pilot brief didn't have should be addable, without touching the
 * controller/route/repository layers. Never DB-aware: callers fetch whatever
 * live numbers (registration counts, timestamps) the config needs and pass
 * them in. Shared by ambassador.service.ts (self-service stats) and
 * ambassador-campaign.service.ts (org-admin report) — one implementation,
 * two callers.
 */

export interface MilestoneRewardResult {
    currentTier: MilestoneTier | null;
    nextTier: MilestoneTier | null;
    progressToNextTier: { current: number; required: number } | null;
    accruedAmount: number;
}

export function computeMilestoneReward(
    tiers: MilestoneTier[],
    registrationCount: number,
): MilestoneRewardResult {
    const sorted = [...tiers].sort((a, b) => a.minRegistrations - b.minRegistrations);

    const currentTier =
        sorted
            .filter((t) => registrationCount >= t.minRegistrations)
            .filter((t) => t.maxRegistrations === null || registrationCount <= t.maxRegistrations)
            .at(-1) ?? null;

    const nextTier = sorted.find((t) => t.minRegistrations > registrationCount) ?? null;

    const progressToNextTier = nextTier
        ? { current: registrationCount, required: nextTier.minRegistrations }
        : null;

    let accruedAmount = 0;
    if (currentTier) {
        // Bracket-only model (pilot brief): the per-registration rate applies only to the
        // registrations that fall within THIS tier's own range, not the full running total —
        // e.g. tier 71-100 at ₹18/reg on a count of 100 pays 30 * ₹18, not 100 * ₹18.
        const registrationsInBracket = registrationCount - currentTier.minRegistrations + 1;
        accruedAmount = registrationsInBracket * currentTier.amountPerRegistration;
        if (currentTier.goodie?.cashEquivalent) {
            accruedAmount += currentTier.goodie.cashEquivalent;
        }
    }

    return { currentTier, nextTier, progressToNextTier, accruedAmount };
}

/**
 * thresholdReachedAt: the createdAt of the Nth referred registration (N =
 * milestoneThreshold), fetched by the caller — this is what makes the bonus
 * "computed, not stored": no ledger row records when a threshold was
 * crossed, we just look at the real Participant timestamp that crossed it.
 */
export function computeSpeedBonus(
    config: SpeedBonusConfig | undefined,
    registrationCount: number,
    thresholdReachedAt: Date | null,
): SpeedBonusResult | null {
    if (!config || !config.enabled || !config.campaignStartAt || config.milestoneThreshold === undefined) return null;
    if (registrationCount < config.milestoneThreshold || !thresholdReachedAt) {
        return { earned: false, tier: null, daysToMilestone: null };
    }

    const daysToMilestone =
        (thresholdReachedAt.getTime() - new Date(config.campaignStartAt).getTime()) / (24 * 60 * 60 * 1000);

    const qualifyingTier = [...config.tiers]
        .sort((a, b) => a.withinDays - b.withinDays)
        .find((t) => daysToMilestone <= t.withinDays);

    return {
        earned: !!qualifyingTier,
        tier: qualifyingTier ?? null,
        daysToMilestone,
    };
}

export interface FullRewardResult extends MilestoneRewardResult {
    speedBonus: SpeedBonusResult | null;
    totalAccrued: number;
}

export function computeFullReward(
    rewardConfig: RewardConfig,
    registrationCount: number,
    thresholdReachedAt: Date | null,
): FullRewardResult {
    const milestone = computeMilestoneReward(rewardConfig.milestoneTiers, registrationCount);
    const speedBonus = computeSpeedBonus(rewardConfig.speedBonus, registrationCount, thresholdReachedAt);
    const bonusAmount = speedBonus?.earned
        ? (speedBonus.tier?.bonusAmount ?? 0) + (speedBonus.tier?.goodie?.cashEquivalent ?? 0)
        : 0;

    return {
        ...milestone,
        speedBonus,
        totalAccrued: milestone.accruedAmount + bonusAmount,
    };
}
