import { ParticipantStatus } from "@prisma/client";

// A regression lock for the "failed/abandoned payment inflates ambassador count" bug —
// every referral-counting query in this repository must exclude PENDING_PAYMENT participants,
// since a paid-contest registration only becomes real once Razorpay confirms payment.
jest.mock("../../config/db", () => ({
    prisma: {
        participant: {
            count: jest.fn().mockResolvedValue(0),
            groupBy: jest.fn().mockResolvedValue([]),
            findMany: jest.fn().mockResolvedValue([]),
        },
        $transaction: jest.fn().mockResolvedValue([[], 0]),
    },
}));

import { prisma } from "../../config/db";
import { AmbassadorCampaignRepository } from "./ambassador-campaign.repository";

const NOT_PENDING_PAYMENT = { status: { not: ParticipantStatus.PENDING_PAYMENT } };

describe("AmbassadorCampaignRepository — referral counts exclude PENDING_PAYMENT", () => {
    const repo = new AmbassadorCampaignRepository();

    afterEach(() => jest.clearAllMocks());

    it("countReferrals excludes PENDING_PAYMENT", async () => {
        await repo.countReferrals("enr1");
        expect(prisma.participant.count).toHaveBeenCalledWith({
            where: expect.objectContaining({ referredByEnrollmentId: "enr1", ...NOT_PENDING_PAYMENT }),
        });
    });

    it("countReferralsForEnrollments excludes PENDING_PAYMENT", async () => {
        await repo.countReferralsForEnrollments(["enr1", "enr2"]);
        expect(prisma.participant.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ referredByEnrollmentId: { in: ["enr1", "enr2"] }, ...NOT_PENDING_PAYMENT }),
            }),
        );
    });

    it("findNthReferralCreatedAt excludes PENDING_PAYMENT", async () => {
        await repo.findNthReferralCreatedAt("enr1", 5);
        expect(prisma.participant.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ referredByEnrollmentId: "enr1", ...NOT_PENDING_PAYMENT }),
            }),
        );
    });

    it("listReferralCreatedAtSince excludes PENDING_PAYMENT", async () => {
        await repo.listReferralCreatedAtSince(["enr1"], new Date("2026-01-01"));
        expect(prisma.participant.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ referredByEnrollmentId: { in: ["enr1"] }, ...NOT_PENDING_PAYMENT }),
            }),
        );
    });

    it("listReferrals excludes PENDING_PAYMENT", async () => {
        (prisma.$transaction as jest.Mock).mockResolvedValueOnce([[], 0]);
        await repo.listReferrals("enr1", { skip: 0, take: 20 });
        expect(prisma.participant.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ referredByEnrollmentId: "enr1", ...NOT_PENDING_PAYMENT }),
            }),
        );
    });
});
