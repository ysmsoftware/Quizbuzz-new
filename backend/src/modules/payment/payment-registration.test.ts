import { ContestService } from "../contest/contest.service";
import { PaymentService } from "./payment.service";
import { ContestStatus, ParticipantStatus, PaymentStatus } from "@prisma/client";
import { createContactToken } from "../../utils/tokens";

// contest.service.ts / payment.service.ts both call the real isFeatureEnabled()
// (backend/src/common/feature-flags.ts), which reads platformFeatureFlag straight
// from Prisma — a genuine DB dependency this suite otherwise has no reason to need,
// since every repository is already mocked above. Without this mock, these tests
// only "pass" by accident: isFeatureEnabled fails closed (DB unreachable in CI) to
// false for every key, which happens to be the desired value for
// new_registrations_paused (not paused) but the wrong one for razorpay_gateway_active
// (gateway inactive) — silently breaking PaymentService.createOrder. Mocking it here
// makes the suite self-contained and its behavior independent of whatever Postgres
// happens to be reachable at test time.
jest.mock("../../common/feature-flags", () => ({
  isFeatureEnabled: jest.fn((key: string) => Promise.resolve(key === "razorpay_gateway_active")),
}));

const sampleToken = createContactToken({
  email: "test@example.com",
  phone: "9876543210",
  organizationId: "org_1",
});

describe("Payment Registration Flow — Resume or Fresh", () => {
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
  let mockRazorpayProvider: any;

  let contestService: ContestService;
  let paymentService: PaymentService;

  beforeEach(() => {
    mockOrgRepo = {};
    mockContestRepo = {
      findBySlugPublic: jest.fn(),
      findById: jest.fn(),
    };
    mockParticipantService = {
      registerParticipant: jest.fn(),
      getParticipantById: jest.fn(),
    };
    mockLeaderboardRepo = {};
    mockContactService = {
      findByEmailOrPhone: jest.fn(),
      createForRegistration: jest.fn(),
    };
    mockMessagingService = {
      enqueueMessage: jest.fn().mockResolvedValue(true),
    };
    mockSubmissionService = {};
    mockSchedulerService = {};

    mockParticipantRepo = {
      findByContactId: jest.fn(),
    };

    mockPaymentRepo = {
      findByParticipantId: jest.fn(),
      create: jest.fn(),
      updateForRetry: jest.fn(),
    };

    mockRazorpayProvider = {
      getPublicKey: jest.fn().mockReturnValue("rzp_test_key"),
      createOrder: jest.fn(),
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
      mockPaymentRepo
    );

    paymentService = new PaymentService(
      mockPaymentRepo,
      mockRazorpayProvider,
      contestService,
      mockParticipantService,
      mockMessagingService
    );
  });

  describe("ContestService.getRegisterStatus", () => {
    it("returns existing: null when contact is not found", async () => {
      mockContestRepo.findBySlugPublic.mockResolvedValue({
        id: "c_1",
        organizationId: "org_1",
      });
      mockContactService.findByEmailOrPhone.mockResolvedValue(null);

      const status = await contestService.getRegisterStatus("contest-slug", sampleToken);
      expect(status).toEqual({ existing: null });
    });

    it("returns REGISTERED status for an already registered participant", async () => {
      mockContestRepo.findBySlugPublic.mockResolvedValue({
        id: "c_1",
        organizationId: "org_1",
      });
      mockContactService.findByEmailOrPhone.mockResolvedValue({ id: "contact_1" });
      mockParticipantRepo.findByContactId.mockResolvedValue({
        id: "part_1",
        registrationRef: "REF-001",
        status: ParticipantStatus.REGISTERED,
      });

      const status = await contestService.getRegisterStatus("contest-slug", sampleToken);
      expect(status).toEqual({
        existing: {
          participantId: "part_1",
          registrationRef: "REF-001",
          status: "REGISTERED",
        },
      });
    });

    it("returns PENDING_PAYMENT with resumable=true when order is recent", async () => {
      mockContestRepo.findBySlugPublic.mockResolvedValue({
        id: "c_1",
        organizationId: "org_1",
      });
      mockContactService.findByEmailOrPhone.mockResolvedValue({ id: "contact_1" });
      mockParticipantRepo.findByContactId.mockResolvedValue({
        id: "part_1",
        registrationRef: "REF-001",
        status: ParticipantStatus.PENDING_PAYMENT,
      });
      mockPaymentRepo.findByParticipantId.mockResolvedValue({
        id: "pay_1",
        status: PaymentStatus.CREATED,
        createdAt: new Date(), // Created just now
      });

      const status = await contestService.getRegisterStatus("contest-slug", sampleToken);
      expect(status.existing?.status).toBe("PENDING_PAYMENT");
      expect(status.existing?.payment?.resumable).toBe(true);
    });

    it("returns PENDING_PAYMENT with resumable=false when order is older than window", async () => {
      mockContestRepo.findBySlugPublic.mockResolvedValue({
        id: "c_1",
        organizationId: "org_1",
      });
      mockContactService.findByEmailOrPhone.mockResolvedValue({ id: "contact_1" });
      mockParticipantRepo.findByContactId.mockResolvedValue({
        id: "part_1",
        registrationRef: "REF-001",
        status: ParticipantStatus.PENDING_PAYMENT,
      });
      // 15 minutes ago (> 10m default window)
      const oldDate = new Date(Date.now() - 15 * 60 * 1000);
      mockPaymentRepo.findByParticipantId.mockResolvedValue({
        id: "pay_1",
        status: PaymentStatus.CREATED,
        createdAt: oldDate,
      });

      const status = await contestService.getRegisterStatus("contest-slug", sampleToken);
      expect(status.existing?.status).toBe("PENDING_PAYMENT");
      expect(status.existing?.payment?.resumable).toBe(false);
    });
  });

  describe("ContestService.registerParticipant (Reuse)", () => {
    it("reuses existing PENDING_PAYMENT participant without throwing ConflictError", async () => {
      const futureDeadline = new Date(Date.now() + 86400000);
      mockContestRepo.findBySlugPublic.mockResolvedValue({
        id: "c_1",
        organizationId: "org_1",
        status: ContestStatus.PUBLISHED,
        registrationDeadline: futureDeadline,
        paymentEnabled: true,
        paymentConfig: { amount: 100, currency: "INR" },
        title: "Test Contest",
      });
      mockContactService.findByEmailOrPhone.mockResolvedValue({ id: "contact_1" });
      mockParticipantRepo.findByContactId.mockResolvedValue({
        id: "existing_part_1",
        registrationRef: "REF-EXISTING",
        status: ParticipantStatus.PENDING_PAYMENT,
      });

      const result = await contestService.registerParticipant("contest-slug", {
        contactToken: sampleToken,
        email: "test@example.com",
        phone: "9876543210",
        firstName: "Test",
        lastName: "User",
      });

      expect(result.participantId).toBe("existing_part_1");
      expect(result.registrationRef).toBe("REF-EXISTING");
      expect(result.paymentRequired).toBe(true);
      expect(mockParticipantService.registerParticipant).not.toHaveBeenCalled();
    });
  });

  describe("PaymentService.createOrder (Resume & Refresh)", () => {
    it("reuses existing Razorpay order if recent and non-failed", async () => {
      mockParticipantService.getParticipantById.mockResolvedValue({
        id: "part_1",
        contestId: "c_1",
        organizationId: "org_1",
        contactId: "cnt_1",
      });
      mockContestRepo.findById.mockResolvedValue({
        id: "c_1",
        organizationId: "org_1",
        paymentEnabled: true,
        paymentConfig: { amount: 100, currency: "INR" },
        title: "Test Contest",
        // getContest() derives manualStartVisibleFrom from startTime.getTime() —
        // required on every mock contest returned from findById, not optional.
        startTime: new Date(Date.now() + 3600_000),
      });
      mockPaymentRepo.findByParticipantId.mockResolvedValue({
        id: "pay_1",
        razorpayOrderId: "order_existing_123",
        amount: 10000,
        currency: "INR",
        status: PaymentStatus.CREATED,
        createdAt: new Date(), // fresh
      });

      const result = await paymentService.createOrder({
        contestId: "c_1",
        participantId: "part_1",
      });

      expect(result.orderId).toBe("order_existing_123");
      expect(mockRazorpayProvider.createOrder).not.toHaveBeenCalled();
    });

    it("refreshes stale Razorpay order in-place when older than reuse window", async () => {
      mockParticipantService.getParticipantById.mockResolvedValue({
        id: "part_1",
        contestId: "c_1",
        organizationId: "org_1",
        contactId: "cnt_1",
      });
      mockContestRepo.findById.mockResolvedValue({
        id: "c_1",
        organizationId: "org_1",
        paymentEnabled: true,
        paymentConfig: { amount: 100, currency: "INR" },
        title: "Test Contest",
        startTime: new Date(Date.now() + 3600_000),
      });
      // 15 minutes old (> 10m window)
      mockPaymentRepo.findByParticipantId.mockResolvedValue({
        id: "pay_1",
        razorpayOrderId: "order_old_123",
        amount: 10000,
        currency: "INR",
        status: PaymentStatus.CREATED,
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      });

      mockRazorpayProvider.createOrder.mockResolvedValue({ id: "order_fresh_456" });
      mockPaymentRepo.updateForRetry.mockResolvedValue({ id: "pay_1" });

      const result = await paymentService.createOrder({
        contestId: "c_1",
        participantId: "part_1",
      });

      expect(result.orderId).toBe("order_fresh_456");
      expect(mockRazorpayProvider.createOrder).toHaveBeenCalled();
      expect(mockPaymentRepo.updateForRetry).toHaveBeenCalledWith({
        participantId: "part_1",
        razorpayOrderId: "order_fresh_456",
      });
    });
  });
});
