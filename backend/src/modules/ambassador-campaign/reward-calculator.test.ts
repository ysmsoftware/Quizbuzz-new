import { applySpeedBonusCaps, computeMilestoneReward, computeSpeedBonus, resolveSpeedBonusStartAt, SpeedBonusCandidate } from "./reward-calculator";
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
        thresholdReachedAt: new Map([[5, daysAfter(thresholdDays)]]),
        bonusStartAt: T0,
    });
    const labels = (r: { tiers: { label: string }[] } | null | undefined) => r?.tiers.map((t) => t.label);

    it("cascades overflow past a full tier to the next tier the ambassador still qualifies for", () => {
        // All three finish fast enough for "Fast" (<=7 days), but it only has room for 1.
        const results = applySpeedBonusCaps(config, [
            candidate("amb-a", 2), // earliest -> claims Fast
            candidate("amb-b", 3), // Fast full -> bumped to Medium (also has room for 1)
            candidate("amb-c", 4), // Fast and Medium both full -> falls to uncapped Slow
        ]);

        expect(labels(results.get("amb-a"))).toEqual(["Fast"]);
        expect(labels(results.get("amb-b"))).toEqual(["Medium"]);
        expect(labels(results.get("amb-c"))).toEqual(["Slow"]);
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

        expect(labels(results.get("amb-a"))).toEqual(["Fast"]);
        expect(labels(results.get("amb-b"))).toEqual(["Medium"]);
        expect(labels(results.get("amb-c"))).toEqual(["Slow"]);
        expect(results.get("amb-d")?.earned).toBe(false);
        expect(results.get("amb-d")?.tiers).toEqual([]);
    });

    it("leaves an unlimited tier's winners uncapped", () => {
        const results = applySpeedBonusCaps(config, [
            candidate("amb-a", 20),
            candidate("amb-b", 21),
            candidate("amb-c", 22),
        ]);

        expect(labels(results.get("amb-a"))).toEqual(["Slow"]);
        expect(labels(results.get("amb-b"))).toEqual(["Slow"]);
        expect(labels(results.get("amb-c"))).toEqual(["Slow"]);
    });

    it("breaks ties on identical thresholdReachedAt by enrollmentId, deterministically", () => {
        const same = daysAfter(2);
        const results = applySpeedBonusCaps(config, [
            { enrollmentId: "amb-z", registrationCount: 5, thresholdReachedAt: new Map([[5, same]]), bonusStartAt: T0 },
            { enrollmentId: "amb-a", registrationCount: 5, thresholdReachedAt: new Map([[5, same]]), bonusStartAt: T0 },
        ]);

        expect(labels(results.get("amb-a"))).toEqual(["Fast"]); // "amb-a" < "amb-z"
        expect(labels(results.get("amb-z"))).toEqual(["Medium"]);
    });

    it("passes through ambassadors who never reached the milestone unchanged", () => {
        const results = applySpeedBonusCaps(config, [
            { enrollmentId: "amb-a", registrationCount: 2, thresholdReachedAt: new Map(), bonusStartAt: T0 },
        ]);
        expect(results.get("amb-a")).toEqual({ earned: false, tiers: [], daysToMilestone: null });
    });
});

describe("per-tier speed bonus thresholds", () => {
    const T0 = new Date("2024-01-01T00:00:00Z");
    const daysAfter = (n: number) => new Date(T0.getTime() + n * 24 * 60 * 60 * 1000);

    // "50 registrations in 8 days" and "80 registrations in 15 days" — independent milestones.
    const config: SpeedBonusConfig = {
        enabled: true,
        campaignStartAt: T0.toISOString(),
        tiers: [
            { milestoneThreshold: 50, withinDays: 8, bonusAmount: 500, label: "50 in 8" },
            { milestoneThreshold: 80, withinDays: 15, bonusAmount: 1000, label: "80 in 15" },
        ],
    };
    const labels = (r: { tiers: { label: string }[] } | null) => r?.tiers.map((t) => t.label);

    it("pays only the later milestone when the earlier one was missed", () => {
        // 50th registration on day 10 (too slow for 8d), 80th on day 14 (in time for 15d).
        const result = computeSpeedBonus(config, 80, new Map([[50, daysAfter(10)], [80, daysAfter(14)]]));
        expect(labels(result)).toEqual(["80 in 15"]);
    });

    it("pays both milestones when both were hit in time", () => {
        const result = computeSpeedBonus(config, 80, new Map([[50, daysAfter(7)], [80, daysAfter(14)]]));
        expect(labels(result)).toEqual(["50 in 8", "80 in 15"]);
        expect(result?.earned).toBe(true);
    });

    it("pays only the reached milestone, and nothing for one not reached yet", () => {
        expect(labels(computeSpeedBonus(config, 60, new Map([[50, daysAfter(5)]])))).toEqual(["50 in 8"]);
        expect(computeSpeedBonus(config, 40, new Map())).toEqual({ earned: false, tiers: [], daysToMilestone: null });
    });

    it("keeps tiers that share a threshold as alternative brackets (fastest met wins)", () => {
        const legacy: SpeedBonusConfig = {
            enabled: true,
            campaignStartAt: T0.toISOString(),
            milestoneThreshold: 5, // no per-tier threshold -> falls back to this one
            tiers: [
                { withinDays: 14, bonusAmount: 300, label: "Medium" },
                { withinDays: 7, bonusAmount: 500, label: "Fast" },
            ],
        };
        expect(labels(computeSpeedBonus(legacy, 5, new Map([[5, daysAfter(3)]])))).toEqual(["Fast"]);
        expect(labels(computeSpeedBonus(legacy, 5, new Map([[5, daysAfter(10)]])))).toEqual(["Medium"]);
    });

    it("applies maxWinners per milestone, so a full 50-tier doesn't block the 80-tier", () => {
        const capped: SpeedBonusConfig = {
            ...config,
            tiers: config.tiers.map((t) => ({ ...t, maxWinners: 1 })),
        };
        const both = (id: string) => ({
            enrollmentId: id,
            registrationCount: 80,
            thresholdReachedAt: new Map([[50, daysAfter(2)], [80, daysAfter(5)]]),
            bonusStartAt: T0,
        });
        const results = applySpeedBonusCaps(capped, [both("amb-a"), both("amb-b")]);
        expect(labels(results.get("amb-a") ?? null)).toEqual(["50 in 8", "80 in 15"]);
        expect(results.get("amb-b")?.earned).toBe(false); // both tiers' single slot went to amb-a
    });

    it("blank maxWinners is unlimited — everyone in the window gets it, in every start mode", () => {
        const unlimited: SpeedBonusConfig = {
            enabled: true,
            campaignStartAtMode: "PER_AMBASSADOR_APPROVAL", // each ambassador's own clock
            tiers: [{ milestoneThreshold: 5, withinDays: 7, bonusAmount: 500, label: "Fast" }], // no maxWinners
        };
        // Approved on different days, each hits 5 registrations 3 days after their own approval.
        const approvedOn = (id: string, day: number): SpeedBonusCandidate => ({
            enrollmentId: id,
            registrationCount: 5,
            thresholdReachedAt: new Map([[5, daysAfter(day + 3)]]),
            bonusStartAt: daysAfter(day),
        });
        const ids = ["a", "b", "c", "d", "e"];
        const results = applySpeedBonusCaps(unlimited, ids.map((id, i) => approvedOn(id, i * 10)));
        for (const id of ids) expect(results.get(id)?.tiers.map((t) => t.label)).toEqual(["Fast"]);
    });

    it("a numeric maxWinners caps that tier to the first N, with per-ambassador clocks too", () => {
        const capped: SpeedBonusConfig = {
            enabled: true,
            campaignStartAtMode: "PER_AMBASSADOR_APPROVAL",
            tiers: [{ milestoneThreshold: 5, withinDays: 7, bonusAmount: 500, label: "Fast", maxWinners: 2 }],
        };
        const approvedOn = (id: string, day: number): SpeedBonusCandidate => ({
            enrollmentId: id,
            registrationCount: 5,
            thresholdReachedAt: new Map([[5, daysAfter(day + 3)]]),
            bonusStartAt: daysAfter(day),
        });
        const results = applySpeedBonusCaps(capped, [approvedOn("a", 0), approvedOn("b", 10), approvedOn("c", 20)]);
        expect(results.get("a")?.earned).toBe(true);
        expect(results.get("b")?.earned).toBe(true);
        expect(results.get("c")?.earned).toBe(false); // first 2 to reach it took both slots
    });
});
