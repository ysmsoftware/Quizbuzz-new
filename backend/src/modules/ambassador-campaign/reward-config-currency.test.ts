import { rewardConfigRupeesToPaise, rewardConfigPaiseToRupees, campaignStatsPaiseToRupees, leaderboardEntryPaiseToRupees } from "./reward-config-currency";
import { DraftRewardConfig, CampaignStats, LeaderboardEntryResult } from "./ambassador-campaign.types";

describe("reward-config-currency", () => {
    const draft: DraftRewardConfig = {
        currency: "INR",
        milestoneTiers: [
            { minRegistrations: 0, maxRegistrations: 10, rewardType: "PER_REGISTRATION", amountPerRegistration: 50.5, goodie: { label: "Mug", cashEquivalent: 100 } },
        ],
        speedBonus: {
            enabled: true,
            tiers: [{ withinDays: 7, bonusAmount: 250, label: "Fast Starter", goodie: { label: "Badge", cashEquivalent: 25.25 } }],
        },
        leaderboardPrizes: [
            {
                scope: { kind: "INDIVIDUAL_AMBASSADOR" },
                label: "Top",
                ranks: [{ rank: 1, cashAmount: 1000, goodie: { label: "Trophy", cashEquivalent: 500 } }],
                consolation: { label: "Consolation", cashAmount: 10.1 },
            },
        ],
    };

    it("round-trips rupees -> paise -> rupees without drift", () => {
        const paise = rewardConfigRupeesToPaise(draft);
        expect(paise.milestoneTiers![0]!.amountPerRegistration).toBe(5050);
        expect(paise.milestoneTiers![0]!.goodie!.cashEquivalent).toBe(10000);
        expect(paise.speedBonus!.tiers[0]!.bonusAmount).toBe(25000);
        expect(paise.leaderboardPrizes![0]!.ranks[0]!.cashAmount).toBe(100000);
        expect(paise.leaderboardPrizes![0]!.consolation!.cashAmount).toBe(1010);

        const rupees = rewardConfigPaiseToRupees(paise);
        expect(rupees.milestoneTiers![0]!.amountPerRegistration).toBe(50.5);
        expect(rupees.speedBonus!.tiers[0]!.goodie!.cashEquivalent).toBe(25.25);
        expect(rupees.leaderboardPrizes![0]!.consolation!.cashAmount).toBe(10.1);
    });

    it("does not mutate the input object (shared-reference safety)", () => {
        const original = JSON.parse(JSON.stringify(draft));
        rewardConfigRupeesToPaise(draft);
        expect(draft).toEqual(original);
    });

    it("converts computed campaign stats without touching non-money fields", () => {
        const stats: CampaignStats = {
            registrationCount: 5,
            currentTier: null,
            nextTier: null,
            progressToNextTier: null,
            accruedAmount: 12345,
            speedBonus: { earned: true, tier: { withinDays: 7, bonusAmount: 500, label: "Fast" }, daysToMilestone: null },
            leaderboardRanks: [],
        };
        const result = campaignStatsPaiseToRupees(stats);
        expect(result.accruedAmount).toBe(123.45);
        expect(result.speedBonus!.tier!.bonusAmount).toBe(5);
        expect(result.registrationCount).toBe(5);
    });

    it("converts a leaderboard entry's prize", () => {
        const entry: LeaderboardEntryResult = { rank: 1, groupKey: "a", label: "A", registrationCount: 3, prize: { rank: 1, cashAmount: 999 } };
        expect(leaderboardEntryPaiseToRupees(entry).prize!.cashAmount).toBe(9.99);
    });
});
