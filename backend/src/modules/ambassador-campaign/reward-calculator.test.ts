import { applySpeedBonusCaps, computeMilestoneReward, resolveSpeedBonusStartAt, SpeedBonusCandidate } from "./reward-calculator";
import { MilestoneTier, SpeedBonusConfig } from "./ambassador-campaign.types";

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

    it("withholds the Level 2 goodie at the start of Level 2 (41 registrations) — not cleared yet", () => {
        const res = computeMilestoneReward(tiers, 41);
        // Level 1: 40 * ₹15 = ₹600
        // Level 2: 1 * ₹15 = ₹15 (no goodie — Level 2's ceiling of 70 hasn't been reached)
        expect(res.accruedAmount).toBe(40 * 1500 + 1 * 1500); // 61,500 paise
        expect(res.tierBreakdown.find((b) => b.tierLabel === "Level 2")?.goodieCashEquivalent).toBeUndefined();
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

describe("resolveSpeedBonusStartAt", () => {
    const reviewedAt = new Date("2024-02-01T00:00:00Z");

    it("returns null when there's no config", () => {
        expect(resolveSpeedBonusStartAt(undefined, reviewedAt)).toBeNull();
    });

    it("reads the global campaignStartAt for the three date-based modes, ignoring reviewedAt", () => {
        for (const mode of ["CONTEST_START", "OFFSET_WEEKS", "CUSTOM"] as const) {
            const config: SpeedBonusConfig = {
                enabled: true,
                campaignStartAt: "2024-01-01T00:00:00Z",
                campaignStartAtMode: mode,
                tiers: [],
            };
            expect(resolveSpeedBonusStartAt(config, reviewedAt)).toEqual(new Date("2024-01-01T00:00:00Z"));
            expect(resolveSpeedBonusStartAt(config, null)).toEqual(new Date("2024-01-01T00:00:00Z"));
        }
    });

    it("uses the ambassador's own reviewedAt for PER_AMBASSADOR_APPROVAL, ignoring campaignStartAt", () => {
        const config: SpeedBonusConfig = {
            enabled: true,
            campaignStartAt: "2024-01-01T00:00:00Z",
            campaignStartAtMode: "PER_AMBASSADOR_APPROVAL",
            tiers: [],
        };
        expect(resolveSpeedBonusStartAt(config, reviewedAt)).toEqual(reviewedAt);
        expect(resolveSpeedBonusStartAt(config, null)).toBeNull();
    });
});

describe("applySpeedBonusCaps", () => {
    const T0 = new Date("2024-01-01T00:00:00Z");
    const daysAfter = (n: number) => new Date(T0.getTime() + n * 24 * 60 * 60 * 1000);

    const config: SpeedBonusConfig = {
        enabled: true,
        milestoneThreshold: 5,
        tiers: [
            { withinDays: 7, bonusAmount: 500, label: "Fast", maxWinners: 1 },
            { withinDays: 14, bonusAmount: 300, label: "Medium", maxWinners: 1 },
            { withinDays: 28, bonusAmount: 100, label: "Slow" }, // uncapped
        ],
    };

    const candidate = (enrollmentId: string, thresholdDays: number): SpeedBonusCandidate => ({
        enrollmentId,
        registrationCount: 5,
        thresholdReachedAt: daysAfter(thresholdDays),
        bonusStartAt: T0,
    });

    it("cascades overflow past a full tier to the next tier the ambassador still qualifies for", () => {
        // All three finish fast enough for "Fast" (<=7 days), but it only has room for 1.
        const results = applySpeedBonusCaps(config, [
            candidate("amb-a", 2), // earliest -> claims Fast
            candidate("amb-b", 3), // Fast full -> bumped to Medium (also has room for 1)
            candidate("amb-c", 4), // Fast and Medium both full -> falls to uncapped Slow
        ]);

        expect(results.get("amb-a")?.tier?.label).toBe("Fast");
        expect(results.get("amb-b")?.tier?.label).toBe("Medium");
        expect(results.get("amb-c")?.tier?.label).toBe("Slow");
    });

    it("marks not-earned once every tier the ambassador qualifies for is full", () => {
        const cappedConfig: SpeedBonusConfig = {
            ...config,
            tiers: config.tiers.map((t) => ({ ...t, maxWinners: 1 })), // every tier capped at 1
        };
        // All four finish within 7 days (qualifying for Fast), but Fast/Medium/Slow each only
        // have room for 1 winner total -> the 4th ambassador has nowhere left to cascade to.
        const results = applySpeedBonusCaps(cappedConfig, [
            candidate("amb-a", 2),
            candidate("amb-b", 3),
            candidate("amb-c", 4),
            candidate("amb-d", 5),
        ]);

        expect(results.get("amb-a")?.tier?.label).toBe("Fast");
        expect(results.get("amb-b")?.tier?.label).toBe("Medium");
        expect(results.get("amb-c")?.tier?.label).toBe("Slow");
        expect(results.get("amb-d")?.earned).toBe(false);
        expect(results.get("amb-d")?.tier).toBeNull();
    });

    it("leaves an unlimited tier's winners uncapped", () => {
        const results = applySpeedBonusCaps(config, [
            candidate("amb-a", 20),
            candidate("amb-b", 21),
            candidate("amb-c", 22),
        ]);

        expect(results.get("amb-a")?.tier?.label).toBe("Slow");
        expect(results.get("amb-b")?.tier?.label).toBe("Slow");
        expect(results.get("amb-c")?.tier?.label).toBe("Slow");
    });

    it("breaks ties on identical thresholdReachedAt by enrollmentId, deterministically", () => {
        const same = daysAfter(2);
        const results = applySpeedBonusCaps(config, [
            { enrollmentId: "amb-z", registrationCount: 5, thresholdReachedAt: same, bonusStartAt: T0 },
            { enrollmentId: "amb-a", registrationCount: 5, thresholdReachedAt: same, bonusStartAt: T0 },
        ]);

        expect(results.get("amb-a")?.tier?.label).toBe("Fast"); // "amb-a" < "amb-z"
        expect(results.get("amb-z")?.tier?.label).toBe("Medium");
    });

    it("passes through ambassadors who never reached the milestone unchanged", () => {
        const results = applySpeedBonusCaps(config, [
            { enrollmentId: "amb-a", registrationCount: 2, thresholdReachedAt: null, bonusStartAt: T0 },
        ]);
        expect(results.get("amb-a")).toEqual({ earned: false, tier: null, daysToMilestone: null });
    });
});
