import { paisaToRupees, rupeesToPaisa } from "../../utils/currency";
import {
    CampaignStats,
    DraftRewardConfig,
    LeaderboardCut,
    LeaderboardEntryResult,
    MilestoneTier,
    SpeedBonusConfig,
    SpeedBonusResult,
} from "./ambassador-campaign.types";

/**
 * rewardConfig carries money in several nested spots (tiers, speed-bonus tiers, leaderboard
 * ranks/consolation, each with an optional goodie cash-equivalent). The API contract is
 * rupees; storage stays paise (§ DECISIONS.md). These walk the tree once each way, always
 * returning new objects — never mutate in place, since reward-calculator.ts/campaign-stats.ts
 * hand back object references straight into a campaign's stored rewardConfig, reused across
 * every ambassador in a loop.
 */

type Goodie = { label: string; cashEquivalent?: number | undefined } | undefined;

function convertGoodie(goodie: Goodie, convert: (n: number) => number): Goodie {
    if (!goodie) return goodie;
    return { ...goodie, ...(goodie.cashEquivalent !== undefined && { cashEquivalent: convert(goodie.cashEquivalent) }) };
}

function convertTier(tier: MilestoneTier, convert: (n: number) => number): MilestoneTier {
    return { ...tier, amountPerRegistration: convert(tier.amountPerRegistration), goodie: convertGoodie(tier.goodie, convert) };
}

function convertSpeedBonus(speedBonus: SpeedBonusConfig | undefined, convert: (n: number) => number): SpeedBonusConfig | undefined {
    if (!speedBonus) return speedBonus;
    return {
        ...speedBonus,
        tiers: speedBonus.tiers.map((t) => ({ ...t, bonusAmount: convert(t.bonusAmount), goodie: convertGoodie(t.goodie, convert) })),
    };
}

function convertLeaderboardCut(cut: LeaderboardCut, convert: (n: number) => number): LeaderboardCut {
    return {
        ...cut,
        ranks: cut.ranks.map((r) => ({
            ...r,
            ...(r.cashAmount !== undefined && { cashAmount: convert(r.cashAmount) }),
            goodie: convertGoodie(r.goodie, convert),
        })),
        ...(cut.consolation && { consolation: { ...cut.consolation, cashAmount: convert(cut.consolation.cashAmount) } }),
    };
}

function convertRewardConfig(config: DraftRewardConfig, convert: (n: number) => number): DraftRewardConfig {
    return {
        ...config,
        milestoneTiers: (config.milestoneTiers ?? []).map((t) => convertTier(t, convert)),
        speedBonus: convertSpeedBonus(config.speedBonus, convert),
        leaderboardPrizes: (config.leaderboardPrizes ?? []).map((c) => convertLeaderboardCut(c, convert)),
    };
}

/** Request side — run on rewardConfig before it's persisted. */
export function rewardConfigRupeesToPaise(config: DraftRewardConfig): DraftRewardConfig {
    return convertRewardConfig(config, rupeesToPaisa);
}

/** Response side — run on rewardConfig as stored (paise) before it's sent to the client. */
export function rewardConfigPaiseToRupees(config: DraftRewardConfig): DraftRewardConfig {
    return convertRewardConfig(config, paisaToRupees);
}

/** Response side — the computed/derived stats shape (accruedAmount + speed-bonus tier), same
 *  paise-in/paise-out contract as reward-calculator.ts, converted once at the response boundary. */
export function campaignStatsPaiseToRupees(stats: CampaignStats): CampaignStats {
    return {
        ...stats,
        accruedAmount: paisaToRupees(stats.accruedAmount),
        speedBonus: stats.speedBonus ? speedBonusResultPaiseToRupees(stats.speedBonus) : null,
    };
}

function speedBonusResultPaiseToRupees(result: SpeedBonusResult): SpeedBonusResult {
    return {
        ...result,
        tier: result.tier
            ? { ...result.tier, bonusAmount: paisaToRupees(result.tier.bonusAmount), goodie: convertGoodie(result.tier.goodie, paisaToRupees) }
            : null,
    };
}

/** Response side — a single leaderboard entry's prize, same shape as a LeaderboardCut rank. */
export function leaderboardEntryPaiseToRupees(entry: LeaderboardEntryResult): LeaderboardEntryResult {
    if (!entry.prize) return entry;
    return {
        ...entry,
        prize: {
            ...entry.prize,
            ...(entry.prize.cashAmount !== undefined && { cashAmount: paisaToRupees(entry.prize.cashAmount) }),
            goodie: convertGoodie(entry.prize.goodie, paisaToRupees),
        },
    };
}
