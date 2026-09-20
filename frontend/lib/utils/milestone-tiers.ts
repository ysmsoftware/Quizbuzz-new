import type { MilestoneTier } from '@/lib/types/ambassador';

type TierBounds = Pick<MilestoneTier, 'minRegistrations' | 'maxRegistrations'>;

/**
 * Milestone tiers are entered by their upper bound only. Each tier's minimum is the previous
 * tier's maximum + 1 (the first starts at 1), so tiers can never overlap or leave a gap — the
 * reward calculator (backend reward-calculator.ts) still reads both bounds, and paying a
 * registration in more than one tier is what happens if the minimums are ever wrong.
 * Expects tiers in ascending order; only the last one may be uncapped.
 */
export function withDerivedMins<T extends TierBounds>(tiers: T[]): T[] {
  let prevTop = 0;
  return tiers.map((tier) => {
    const minRegistrations = prevTop + 1;
    prevTop = tier.maxRegistrations ?? minRegistrations;
    return { ...tier, minRegistrations };
  });
}

const plural = (n: number) => `${n} registration${n === 1 ? '' : 's'}`;

/**
 * A tier is shown by its limit alone ("25", "50", "80"…), never a "1–25" range — a range reads as
 * "anywhere inside it earns the tier's goodie", and the minimum is only ever derived anyway (see
 * withDerivedMins). An uncapped top tier has no limit, so it shows where it starts ("111+").
 * No trailing "registrations": callers add it (or not) to fit their layout.
 */
export function tierRangeLabel(tier: TierBounds): string {
  return tier.maxRegistrations === null ? `${tier.minRegistrations}+` : String(tier.maxRegistrations);
}

/** Same as tierRangeLabel but a full phrase, e.g. "25 registrations". */
export function tierRangePhrase(tier: TierBounds): string {
  return tier.maxRegistrations === null ? `${tier.minRegistrations}+ registrations` : plural(tier.maxRegistrations);
}

/** The registration count at which a tier's goodie is actually won — its ceiling, or, for an
 *  uncapped top tier, its floor (matches computeMilestoneReward's `tierCleared`). */
export function unlockAt(tier: TierBounds): number {
  return tier.maxRegistrations ?? tier.minRegistrations;
}

export const unlockPhrase = (tier: TierBounds) => `Unlocks at ${plural(unlockAt(tier))}`;
