import { PaymentService } from "./payment.service";
import { PaymentStatus } from "@prisma/client";

// Same rationale as payment-registration.test.ts: keep this suite self-contained.
jest.mock("../../common/feature-flags", () => ({
  isFeatureEnabled: jest.fn(() => Promise.resolve(true)),
}));

describe("PaymentService.handleWebhook — payment.captured", () => {
  let mockPaymentRepo: any;
  let mockRazorpayProvider: any;
  let mockParticipantService: any;
  let mockMessagingService: any;
  let mockOrganizationRepo: any;
  let paymentService: PaymentService;

  const paymentEntity = {
    id: "pay_razorpay_1",
    order_id: "order_1",
    amount: 10000,
    created_at: Math.floor(Date.now() / 1000),
    method: "upi",
    email: "participant@example.com",
    contact: "9876543210",
  };

  beforeEach(() => {
    mockPaymentRepo = {
      findByRazorpayOrderId: jest.fn().mockResolvedValue({
        id: "pay_1",
        organizationId: "org_1",
        contestId: "contest_1",
        participantId: "part_1",
        amount: 10000,
        currency: "INR",
        status: PaymentStatus.CREATED,
      }),
      markSuccess: jest.fn().mockResolvedValue(undefined),
    };

    mockRazorpayProvider = {
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    };

    mockParticipantService = {
      confirmPaymentRegistration: jest.fn().mockResolvedValue(undefined),
      getParticipantById: jest.fn().mockResolvedValue({
        contact: { firstName: "Test", lastName: "User" },
        contest: { title: "Test Contest", slug: "test-contest", joinCode: "ABC123", startTime: new Date() },
      }),
    };

    mockMessagingService = {
      enqueueMessage: jest.fn().mockResolvedValue(true),
    };

    mockOrganizationRepo = {
      findTimezone: jest.fn().mockResolvedValue("Asia/Kolkata"),
    };

    paymentService = new PaymentService(
      mockPaymentRepo,
      mockRazorpayProvider,
      {} as any, // contestService — unused by handleWebhook
      mockParticipantService,
      mockMessagingService,
      undefined, // payoutService
      mockOrganizationRepo,
    );
  });

  // Regression test for the audit finding: the payment webhook used to only send
  // PAYMENT_CONFIRMATION_MESSAGE, leaving paid registrants without the join-code/link
  // confirmation that free-contest registrants always got. Both messages must now be queued.
  it("queues both PAYMENT_CONFIRMATION_MESSAGE and REGISTRATION_SUCCESSFUL after a captured payment", async () => {
    const payload = {
      event: "payment.captured",
      payload: { payment: { entity: paymentEntity } },
    };

    await paymentService.handleWebhook("sig", payload);

    // enqueueMessage calls happen inside a detached .then() chain — flush microtasks.
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockParticipantService.confirmPaymentRegistration).toHaveBeenCalledWith("part_1");
    expect(mockMessagingService.enqueueMessage).toHaveBeenCalledTimes(2);

    const templates = mockMessagingService.enqueueMessage.mock.calls.map((call: any[]) => call[1].template);
    expect(templates).toContain("PAYMENT_CONFIRMATION_MESSAGE");
    expect(templates).toContain("REGISTRATION_SUCCESSFUL");

    const registrationCall = mockMessagingService.enqueueMessage.mock.calls.find(
      (call: any[]) => call[1].template === "REGISTRATION_SUCCESSFUL",
    );
    expect(registrationCall[1].params.joinCode).toBe("ABC123");
  });
});
