import { MilestoneTier, RewardConfig, SpeedBonusConfig, TierBracketBreakdown } from "./ambassador-campaign.types";
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
    tierBreakdown: TierBracketBreakdown[];
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
    const tierBreakdown: TierBracketBreakdown[] = [];
    sorted.forEach((tier, i) => {
        if (registrationCount >= tier.minRegistrations) {
            const limit = tier.maxRegistrations === null ? registrationCount : Math.min(registrationCount, tier.maxRegistrations);
            const registrationsInBracket = limit - tier.minRegistrations + 1;

            if (registrationsInBracket > 0) {
                const bracketAmount = registrationsInBracket * tier.amountPerRegistration;
                // A tier's goodie is a "finish this level" reward, not a "you're in range" one —
                // it only pays out once the tier's own ceiling is reached (or, for the uncapped
                // top tier, once its floor is reached, since there's no further ceiling to clear).
                const tierCleared = tier.maxRegistrations === null || registrationCount >= tier.maxRegistrations;
                const goodieCash = tierCleared ? (tier.goodie?.cashEquivalent ?? 0) : 0;
                accruedAmount += bracketAmount + goodieCash;
                tierBreakdown.push({
                    tierLabel: tier.label ?? `Level ${i + 1}`,
                    minRegistrations: tier.minRegistrations,
                    maxRegistrations: tier.maxRegistrations,
                    registrationsInBracket,
                    amountPerRegistration: tier.amountPerRegistration,
                    subtotal: bracketAmount + goodieCash,
                    ...(goodieCash > 0 && { goodieLabel: tier.goodie!.label, goodieCashEquivalent: goodieCash, goodieImageUrl: tier.goodie!.imageUrl }),
                });
            }
        }
    });

    return { currentTier, nextTier, progressToNextTier, accruedAmount, tierBreakdown };
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

/**
 * The speed-bonus clock's start, per enrollment. Every mode except PER_AMBASSADOR_APPROVAL
 * resolves to the one global campaignStartAt the frontend already computed (see
 * SpeedBonusEditor.tsx) — unchanged from before this mode existed. PER_AMBASSADOR_APPROVAL
 * ignores campaignStartAt and starts each ambassador's own clock at their enrollment's
 * reviewedAt (fetched by the caller — this function stays DB-unaware, same as the rest of
 * this file), so joining/getting approved late no longer forecloses the fast tiers.
 */
export function resolveSpeedBonusStartAt(
    config: SpeedBonusConfig | undefined,
    enrollmentReviewedAt: Date | null,
): Date | null {
    if (!config) return null;
    if (config.campaignStartAtMode === "PER_AMBASSADOR_APPROVAL") return enrollmentReviewedAt;
    return config.campaignStartAt ? new Date(config.campaignStartAt) : null;
}

export interface SpeedBonusCandidate {
    enrollmentId: string;
    registrationCount: number;
    thresholdReachedAt: Date | null;
    bonusStartAt: Date | null;
}

/**
 * Campaign-wide pass enforcing tiers[].maxWinners — computeSpeedBonus above only ever answers
 * "which tier would this one ambassador qualify for", with no notion of how many others
 * already claimed it, so the cap has to be applied across every candidate at once.
 *
 * Tiers are speed brackets, not a ladder each ambassador collects every rung of (see
 * computeSpeedBonus: the first tier, ascending by withinDays, whose threshold the
 * ambassador's speed satisfies). So when a candidate's bracket is full, they aren't simply
 * dropped — they cascade to the next slower tier they still qualify for (their
 * daysToMilestone trivially also satisfies any tier with a larger withinDays), same as a
 * standings list backfilling from the next rank down. Only excluded entirely once every
 * tier they qualify for is full. Candidates are ranked earliest-thresholdReachedAt-first so
 * earlier finishers get first claim on a capped tier; ties broken by enrollmentId for
 * determinism. A tier with maxWinners left unset stays unlimited, so a campaign that never
 * sets it sees no behavior change from before this cap existed.
 */
export function applySpeedBonusCaps(
    config: SpeedBonusConfig | undefined,
    candidates: SpeedBonusCandidate[],
): Map<string, SpeedBonusResult | null> {
    const results = new Map<string, SpeedBonusResult | null>();
    const sortedTiers = [...(config?.tiers ?? [])].sort((a, b) => a.withinDays - b.withinDays);

    const uncapped = candidates.map((c) => ({
        ...c,
        speedBonus: computeSpeedBonus(
            config && c.bonusStartAt ? { ...config, campaignStartAt: c.bonusStartAt.toISOString() } : config,
            c.registrationCount,
            c.thresholdReachedAt,
        ),
    }));

    // Only candidates who qualified for some (uncapped) tier need ranking/cascading — everyone
    // else (not enabled, below milestone, past every tier's withinDays) keeps their result as-is.
    const ranked = uncapped
        .filter((c) => c.speedBonus?.tier)
        .sort((a, b) => {
            const diff = a.thresholdReachedAt!.getTime() - b.thresholdReachedAt!.getTime();
            return diff !== 0 ? diff : a.enrollmentId.localeCompare(b.enrollmentId);
        });

    const winnerCountByTierIndex = new Map<number, number>();
    for (const candidate of ranked) {
        const startIndex = sortedTiers.indexOf(candidate.speedBonus!.tier!);
        let placedAt = -1;
        for (let i = startIndex; i < sortedTiers.length; i++) {
            const cap = sortedTiers[i]!.maxWinners;
            const count = winnerCountByTierIndex.get(i) ?? 0;
            if (cap === undefined || count < cap) {
                winnerCountByTierIndex.set(i, count + 1);
                placedAt = i;
                break;
            }
        }
        results.set(
            candidate.enrollmentId,
            placedAt === -1
                ? { earned: false, tier: null, daysToMilestone: candidate.speedBonus!.daysToMilestone }
                : { earned: true, tier: sortedTiers[placedAt]!, daysToMilestone: candidate.speedBonus!.daysToMilestone },
        );
    }

    for (const c of uncapped) {
        if (!results.has(c.enrollmentId)) results.set(c.enrollmentId, c.speedBonus);
    }

    return results;
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
