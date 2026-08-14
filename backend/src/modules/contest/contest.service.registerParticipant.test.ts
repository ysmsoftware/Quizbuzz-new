import { ContestStatus, ParticipantStatus } from "@prisma/client";
import { ContestService } from "./contest.service";

jest.mock("../../utils/tokens", () => ({
    verifyContactToken: jest.fn(),
}));
jest.mock("../../common/feature-flags", () => ({
    isFeatureEnabled: jest.fn(),
}));

import { verifyContactToken } from "../../utils/tokens";
import { isFeatureEnabled } from "../../common/feature-flags";

const mockedVerifyContactToken = verifyContactToken as jest.Mock;
const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

describe("ContestService.registerParticipant — ambassador referral capture (§6.5)", () => {
    let contestService: ContestService;
    let mockOrgRepo: any;
    let mockContestRepo: any;
    let mockParticipantService: any;
    let mockLeaderboardRepo: any;
    let mockContactService: any;
    let mockMessagingService: any;
    let mockSubmissionService: any;
    let mockSchedulerService: any;
    let mockParticipantRepo: any;
    let mockPaymentRepo: any;
    let mockAmbassadorCampaignRepo: any;

    const baseContest = {
        id: "contest_1",
        organizationId: "org_1",
        slug: "gk-cup",
        title: "GK Cup",
        status: ContestStatus.PUBLISHED,
        registrationDeadline: new Date(Date.now() + 60 * 60 * 1000),
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        maxParticipants: null,
        paymentEnabled: false,
        joinCode: "ABC123",
    };

    const baseDto = {
        contactToken: "token_abc",
        email: "student@example.com",
        phone: "9876543210",
        firstName: "Asha",
        lastName: "Rao",
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockedIsFeatureEnabled.mockResolvedValue(false);
        mockedVerifyContactToken.mockResolvedValue({ email: baseDto.email, organizationId: "org_1" });

        mockOrgRepo = {
            findTimezone: jest.fn().mockResolvedValue("Asia/Kolkata"),
        };
        mockContestRepo = {
            findBySlugPublic: jest.fn().mockResolvedValue({ ...baseContest }),
        };
        mockParticipantService = {
            registerParticipant: jest.fn().mockResolvedValue({
                id: "participant_1",
                registrationRef: "QB-TEST-001",
                status: ParticipantStatus.REGISTERED,
            }),
        };
        mockLeaderboardRepo = {};
        mockContactService = {
            findByEmailOrPhone: jest.fn().mockResolvedValue(null),
            createForRegistration: jest.fn().mockResolvedValue({ id: "contact_1" }),
        };
        mockMessagingService = {
            enqueueMessage: jest.fn().mockResolvedValue(undefined),
        };
        mockSubmissionService = {};
        mockSchedulerService = {};
        mockParticipantRepo = {
            findByContactId: jest.fn().mockResolvedValue(null),
        };
        mockPaymentRepo = {};
        mockAmbassadorCampaignRepo = {
            findEnrollmentByReferralCodeForContest: jest.fn().mockResolvedValue({ id: "enrollment_1" }),
        };

        contestService = new ContestService(
            mockOrgRepo,
            mockContestRepo,
            mockParticipantService,
            mockLeaderboardRepo,
            mockContactService,
            mockMessagingService,
            mockSubmissionService,
            mockSchedulerService,
            mockParticipantRepo,
            mockPaymentRepo,
            mockAmbassadorCampaignRepo,
        );
    });

    it("registers successfully with no referralCode, without touching the ambassador repo, and an unchanged response shape", async () => {
        const result = await contestService.registerParticipant("gk-cup", { ...baseDto } as any);

        expect(mockAmbassadorCampaignRepo.findEnrollmentByReferralCodeForContest).not.toHaveBeenCalled();

        expect(mockParticipantService.registerParticipant).toHaveBeenCalledWith(
            expect.objectContaining({
                organizationId: "org_1",
                contestId: "contest_1",
                contactId: "contact_1",
                status: ParticipantStatus.REGISTERED,
            }),
        );
        // No referredByEnrollmentId key at all when ref is absent — the call
        // shape must be byte-for-byte identical to before this change.
        const callArg = mockParticipantService.registerParticipant.mock.calls[0][0];
        expect(callArg).not.toHaveProperty("referredByEnrollmentId");

        expect(result).toEqual({
            registrationRef: "QB-TEST-001",
            participantId: "participant_1",
            paymentRequired: false,
            status: "REGISTERED",
        });
    });

    it("still works when the ambassador repo dependency is entirely absent (optional constructor param)", async () => {
        const serviceWithoutAmbassadorRepo = new ContestService(
            mockOrgRepo,
            mockContestRepo,
            mockParticipantService,
            mockLeaderboardRepo,
            mockContactService,
            mockMessagingService,
            mockSubmissionService,
            mockSchedulerService,
            mockParticipantRepo,
            mockPaymentRepo,
        );

        const result = await serviceWithoutAmbassadorRepo.registerParticipant("gk-cup", { ...baseDto } as any);

        expect(result.paymentRequired).toBe(false);
        expect(mockParticipantService.registerParticipant).toHaveBeenCalled();
    });

    it("resolves referredByEnrollmentId onto the created participant when a valid referralCode is present", async () => {
        await contestService.registerParticipant("gk-cup", { ...baseDto, referralCode: "REF123" } as any);

        expect(mockAmbassadorCampaignRepo.findEnrollmentByReferralCodeForContest).toHaveBeenCalledWith("REF123", "contest_1");
        expect(mockParticipantService.registerParticipant).toHaveBeenCalledWith(
            expect.objectContaining({ referredByEnrollmentId: "enrollment_1" }),
        );
    });

    it("proceeds unattributed when referralCode doesn't resolve to an enrollment", async () => {
        mockAmbassadorCampaignRepo.findEnrollmentByReferralCodeForContest.mockResolvedValue(null);

        const result = await contestService.registerParticipant("gk-cup", { ...baseDto, referralCode: "UNKNOWN" } as any);

        const callArg = mockParticipantService.registerParticipant.mock.calls[0][0];
        expect(callArg).not.toHaveProperty("referredByEnrollmentId");
        expect(result.paymentRequired).toBe(false);
    });
});
