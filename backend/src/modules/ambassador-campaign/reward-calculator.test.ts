import { computeMilestoneReward } from "./reward-calculator";
import { MilestoneTier } from "./ambassador-campaign.types";

describe("reward-calculator milestone reward progression", () => {
    const tiers: MilestoneTier[] = [
        {
            minRegistrations: 1,
            maxRegistrations: 40,
            rewardType: "PER_REGISTRATION",
            amountPerRegistration: 1500, // ₹15
            label: "Level 1",
        },
        {
            minRegistrations: 41,
            maxRegistrations: 70,
            rewardType: "PER_REGISTRATION",
            amountPerRegistration: 1500, // ₹15
            goodie: { label: "Gift Voucher", cashEquivalent: 80000 }, // ₹800
            label: "Level 2",
        },
        {
            minRegistrations: 71,
            maxRegistrations: 100,
            rewardType: "PER_REGISTRATION",
            amountPerRegistration: 1800, // ₹18
            label: "Level 3",
        },
    ];

    it("returns zero rewards for 0 registrations", () => {
        const res = computeMilestoneReward(tiers, 0);
        expect(res.accruedAmount).toBe(0);
        expect(res.currentTier).toBeNull();
        expect(res.nextTier!.label).toBe("Level 1");
    });

    it("calculates exact amount at the boundary of Level 1 (40 registrations)", () => {
        const res = computeMilestoneReward(tiers, 40);
        expect(res.accruedAmount).toBe(40 * 1500); // 60,000 paise (₹600)
        expect(res.currentTier!.label).toBe("Level 1");
        expect(res.nextTier!.label).toBe("Level 2");
    });

    it("calculates progressive amount + goodie at the start of Level 2 (41 registrations)", () => {
        const res = computeMilestoneReward(tiers, 41);
        // Progressive check:
        // Level 1: 40 * ₹15 = ₹600
        // Level 2: 1 * ₹15 = ₹15
        // Level 2 goodie: ₹800
        // Total: ₹1415 (141,500 paise)
        // If it were bracket-only, it would be 1 * ₹15 + ₹800 = ₹815 (81,500 paise)
        expect(res.accruedAmount).toBe(40 * 1500 + 1 * 1500 + 80000); // 141,500 paise
        expect(res.currentTier!.label).toBe("Level 2");
        expect(res.nextTier!.label).toBe("Level 3");
    });

    it("calculates progressive amount at the boundary of Level 2 (70 registrations)", () => {
        const res = computeMilestoneReward(tiers, 70);
        // Level 1: 40 * 1500 = 60,000 paise
        // Level 2: 30 * 1500 = 45,000 paise
        // Level 2 goodie: 80,000 paise
        // Total: 185,000 paise
        expect(res.accruedAmount).toBe(40 * 1500 + 30 * 1500 + 80000); // 185,000 paise
        expect(res.currentTier!.label).toBe("Level 2");
        expect(res.nextTier!.label).toBe("Level 3");
    });

    it("calculates progressive amount for Level 3 (100 registrations)", () => {
        const res = computeMilestoneReward(tiers, 100);
        // Level 1: 40 * 1500 = 60,000 paise
        // Level 2: 30 * 1500 = 45,000 paise
        // Level 2 goodie: 80,000 paise
        // Level 3: 30 * 1800 = 54,000 paise
        // Total: 239,000 paise
        expect(res.accruedAmount).toBe(40 * 1500 + 30 * 1500 + 80000 + 30 * 1800); // 239,000 paise
        expect(res.currentTier!.label).toBe("Level 3");
        expect(res.nextTier).toBeNull();
    });
});
