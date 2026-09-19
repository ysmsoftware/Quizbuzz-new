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

const DAY_MS = 24 * 60 * 60 * 1000;

type ResolvedSpeedBonusTier = SpeedBonusConfig["tiers"][number] & { milestoneThreshold: number };

/**
 * Speed-bonus tiers bucketed by the registration count they pay out at (a tier's own
 * milestoneThreshold, else the campaign-wide one older campaigns still carry), each bucket
 * sorted fastest-first. Buckets are independent milestones — "50 in 8 days" and "80 in 15
 * days" each pay on their own. Tiers sharing a threshold stay alternative speed brackets of
 * that one milestone (the fastest bracket met wins), which is exactly how a single-threshold
 * campaign behaved before per-tier thresholds existed.
 */
export function speedBonusTierGroups(config: SpeedBonusConfig): ResolvedSpeedBonusTier[][] {
    const groups = new Map<number, ResolvedSpeedBonusTier[]>();
    for (const t of config.tiers) {
        const milestoneThreshold = t.milestoneThreshold ?? config.milestoneThreshold;
        if (milestoneThreshold === undefined || milestoneThreshold < 1) continue; // unset/0 = draft row, not payable
        groups.set(milestoneThreshold, [...(groups.get(milestoneThreshold) ?? []), { ...t, milestoneThreshold }]);
    }
    return [...groups.values()].map((g) => g.sort((a, b) => a.withinDays - b.withinDays));
}

/** Every distinct registration count a caller must look up a "reached at" timestamp for. */
export function speedBonusThresholds(config: SpeedBonusConfig): number[] {
    return speedBonusTierGroups(config).map((g) => g[0]!.milestoneThreshold);
}

/** Days from the clock start to the Nth registration; null if not reached / no clock start. */
function daysToThreshold(
    startAt: string | undefined,
    registrationCount: number,
    threshold: number,
    thresholdReachedAt: ReadonlyMap<number, Date>,
): number | null {
    const reachedAt = thresholdReachedAt.get(threshold);
    if (!startAt || registrationCount < threshold || !reachedAt) return null;
    return (reachedAt.getTime() - new Date(startAt).getTime()) / DAY_MS;
}

/**
 * thresholdReachedAt: threshold → the createdAt of the Nth referred registration (N = that
 * threshold), fetched by the caller for each speedBonusThresholds(config) entry — this is
 * what makes the bonus "computed, not stored": no ledger row records when a threshold was
 * crossed, we just look at the real Participant timestamp that crossed it. Absent = not
 * reached yet.
 */
export function computeSpeedBonus(
    config: SpeedBonusConfig | undefined,
    registrationCount: number,
    thresholdReachedAt: ReadonlyMap<number, Date>,
): SpeedBonusResult | null {
    if (!config || !config.enabled || !config.campaignStartAt) return null;
    const groups = speedBonusTierGroups(config);
    if (groups.length === 0) return null;

    const tiers: ResolvedSpeedBonusTier[] = [];
    let daysToMilestone: number | null = null;
    for (const group of groups) {
        const days = daysToThreshold(config.campaignStartAt, registrationCount, group[0]!.milestoneThreshold, thresholdReachedAt);
        if (days === null) continue;
        daysToMilestone = daysToMilestone === null ? days : Math.min(daysToMilestone, days);
        const tier = group.find((t) => days <= t.withinDays);
        if (tier) tiers.push(tier);
    }

    return { earned: tiers.length > 0, tiers, daysToMilestone };
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
    thresholdReachedAt: ReadonlyMap<number, Date>;
    bonusStartAt: Date | null;
}

/**
 * Campaign-wide pass enforcing tiers[].maxWinners — computeSpeedBonus above only ever answers
 * "which tiers would this one ambassador qualify for", with no notion of how many others
 * already claimed them, so the cap has to be applied across every candidate at once.
 *
 * Each milestone (tier bucket, see speedBonusTierGroups) is ranked independently: within a
 * bucket the tiers are speed brackets, so when a candidate's bracket is full they aren't
 * simply dropped — they cascade to the next slower bracket they still qualify for (their
 * daysToMilestone trivially also satisfies any bracket with a larger withinDays), same as a
 * standings list backfilling from the next rank down. Only excluded from that milestone once
 * every bracket they qualify for is full. Candidates are ranked earliest-reached-first so
 * earlier finishers get first claim on a capped tier; ties broken by enrollmentId for
 * determinism. A tier with maxWinners left unset stays unlimited.
 */
export function applySpeedBonusCaps(
    config: SpeedBonusConfig | undefined,
    candidates: SpeedBonusCandidate[],
): Map<string, SpeedBonusResult | null> {
    const startOf = (c: SpeedBonusCandidate) => c.bonusStartAt?.toISOString() ?? config?.campaignStartAt;
    const results = new Map<string, SpeedBonusResult | null>(
        candidates.map((c) => [
            c.enrollmentId,
            computeSpeedBonus(config && { ...config, campaignStartAt: startOf(c) }, c.registrationCount, c.thresholdReachedAt),
        ]),
    );
    if (!config) return results;

    const won = new Map<string, ResolvedSpeedBonusTier[]>();
    for (const group of speedBonusTierGroups(config)) {
        const threshold = group[0]!.milestoneThreshold;
        const daysOf = (c: SpeedBonusCandidate) => daysToThreshold(startOf(c), c.registrationCount, threshold, c.thresholdReachedAt);
        const ranked = candidates
            .filter((c) => results.get(c.enrollmentId) && daysOf(c) !== null)
            .sort((a, b) => {
                const diff = a.thresholdReachedAt.get(threshold)!.getTime() - b.thresholdReachedAt.get(threshold)!.getTime();
                return diff !== 0 ? diff : a.enrollmentId.localeCompare(b.enrollmentId);
            });

        const winners = group.map(() => 0);
        for (const c of ranked) {
            const days = daysOf(c)!;
            for (let i = group.findIndex((t) => days <= t.withinDays); i >= 0 && i < group.length; i++) {
                const cap = group[i]!.maxWinners;
                if (cap !== undefined && winners[i]! >= cap) continue;
                winners[i]!++;
                won.set(c.enrollmentId, [...(won.get(c.enrollmentId) ?? []), group[i]!]);
                break;
            }
        }
    }

    for (const [enrollmentId, result] of results) {
        if (!result) continue;
        const tiers = (won.get(enrollmentId) ?? []).sort((a, b) => a.withinDays - b.withinDays);
        results.set(enrollmentId, { ...result, earned: tiers.length > 0, tiers });
    }
    return results;
}

/** Cash value of every speed-bonus tier earned (bonus + goodie cash equivalent). */
export function speedBonusTotal(speedBonus: SpeedBonusResult | null): number {
    return (speedBonus?.tiers ?? []).reduce((sum, t) => sum + t.bonusAmount + (t.goodie?.cashEquivalent ?? 0), 0);
}

export interface FullRewardResult extends MilestoneRewardResult {
    speedBonus: SpeedBonusResult | null;
    totalAccrued: number;
}

export function computeFullReward(
    rewardConfig: RewardConfig,
    registrationCount: number,
    thresholdReachedAt: ReadonlyMap<number, Date>,
): FullRewardResult {
    const milestone = computeMilestoneReward(rewardConfig.milestoneTiers, registrationCount);
    const speedBonus = computeSpeedBonus(rewardConfig.speedBonus, registrationCount, thresholdReachedAt);
    const bonusAmount = speedBonusTotal(speedBonus);

    return {
        ...milestone,
        speedBonus,
        totalAccrued: milestone.accruedAmount + bonusAmount,
    };
}
