/**
 * One-off operational script — inserts the YSM pilot brief as a normal
 * AmbassadorCampaignTemplate row, scoped to the org passed via --orgId.
 * Not part of any request path; run once after deploy, then done.
 *
 *   npx ts-node prisma/seeds/seed-ysm-pilot-template.ts --orgId=<organizationId>
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const rewardConfig = {
    currency: "INR",
    amountsInPaise: true,
    milestoneTiers: [
        { label: "Level 1 (1–40)", minRegistrations: 1, maxRegistrations: 40, rewardType: "PER_REGISTRATION", amountPerRegistration: 1500 },
        { label: "Level 2 (41–70)", minRegistrations: 41, maxRegistrations: 70, rewardType: "PER_REGISTRATION", amountPerRegistration: 1500, goodie: { label: "Gift Voucher", cashEquivalent: 80000 } },
        { label: "Level 3 (71–100)", minRegistrations: 71, maxRegistrations: 100, rewardType: "PER_REGISTRATION", amountPerRegistration: 1800, goodie: { label: "Bluetooth Earbuds", cashEquivalent: 150000 } },
        { label: "Level 4 (100+ Stretch)", minRegistrations: 100, maxRegistrations: null, rewardType: "PER_REGISTRATION", amountPerRegistration: 2000 },
    ],
    speedBonus: {
        enabled: true,
        tiers: [
            { withinDays: 7, bonusAmount: 50000, label: "Fast Starter", maxWinners: 10, goodie: { label: "Fast Starter Badge", cashEquivalent: 0 } },
            { withinDays: 14, bonusAmount: 30000, label: "Early Finisher", maxWinners: 15 },
            { withinDays: 28, bonusAmount: 15000, label: "On Track", maxWinners: 15 },
        ],
    },
    leaderboardPrizes: [
        {
            scope: { kind: "INDIVIDUAL_AMBASSADOR" },
            label: "Top Individual Ambassadors",
            ranks: [
                { rank: 1, cashAmount: 200000, label: "1st Place", goodie: { label: "Free Premium Internship + Certificate of Excellence", cashEquivalent: 0 } },
                { rank: 2, cashAmount: 150000, label: "2nd Place", goodie: { label: "Certificate of Excellence", cashEquivalent: 0 } },
                { rank: 3, cashAmount: 100000, label: "3rd Place", goodie: { label: "Certificate of Excellence", cashEquivalent: 0 } },
            ],
        },
        {
            scope: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["department"] },
            label: "Overall Department Leaderboard",
            ranks: [
                { rank: 1, cashAmount: 0, label: "1st Place Dept", goodie: { label: "Bluetooth Speaker + Certificate", cashEquivalent: 300000 } },
                { rank: 2, cashAmount: 0, label: "2nd Place Dept", goodie: { label: "Gift Hamper + Certificate", cashEquivalent: 200000 } },
                { rank: 3, cashAmount: 0, label: "3rd Place Dept", goodie: { label: "Gift Voucher + Certificate", cashEquivalent: 100000 } },
            ],
        },
        {
            scope: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["college", "department"] },
            label: "Inter-College Department Leaderboard",
            ranks: [
                { rankRange: [1, 3], cashAmount: 0, label: "Top Dept per College", goodie: { label: "Voucher/Gadget + Appreciation Certificate", cashEquivalent: 100000 } },
            ],
        },
        {
            scope: { kind: "APPLICATION_FIELD_GROUP", groupByFieldKeys: ["college"] },
            label: "College Leaderboard",
            ranks: [
                { rank: 1, cashAmount: 800000, label: "1st Place College", goodie: { label: "Trophy", cashEquivalent: 80000 } },
                { rank: 2, cashAmount: 500000, label: "2nd Place College", goodie: { label: "Trophy", cashEquivalent: 80000 } },
                { rank: 3, cashAmount: 300000, label: "3rd Place College", goodie: { label: "Trophy", cashEquivalent: 80000 } },
            ],
        },
    ],
};

const groups = [
    { groupType: "DEPARTMENT", name: "Departments (50)", ambassadorTarget: 50, registrationTarget: 100 },
    { groupType: "COLLEGE", name: "Colleges (17)", ambassadorTarget: 17, registrationTarget: 100 },
];

async function main() {
    const orgIdArg = process.argv.find((a) => a.startsWith("--orgId="));
    const organizationId = orgIdArg?.split("=")[1];
    if (!organizationId) {
        throw new Error("Usage: ts-node seed-ysm-pilot-template.ts --orgId=<organizationId>");
    }

    const template = await prisma.ambassadorCampaignTemplate.create({
        data: {
            organizationId,
            name: "QuizBuzz 5,000-Registration Pilot Campaign",
            ambassadorTypesAllowed: ["COLLEGE_STUDENT", "COMMUNITY"],
            rewardConfig: rewardConfig as unknown as Prisma.InputJsonValue,
            shareTemplates: {},
            groups: groups as unknown as Prisma.InputJsonValue,
            createdById: "system",
        },
    });

    console.log(`Created template ${template.id} for org ${organizationId}`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
