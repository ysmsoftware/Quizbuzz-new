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
      markFailed: jest.fn().mockResolvedValue(undefined),
      findOrder: jest.fn().mockResolvedValue(null),
      findByParticipantId: jest.fn().mockResolvedValue(null),
      recordOrder: jest.fn().mockResolvedValue(undefined),
      updateOrder: jest.fn().mockResolvedValue(undefined),
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

  // Regression: UPI sends payment.failed ("Payment declined by bank") and then
  // payment.captured for the same order. The capture used to be dropped.
  it("marks a FAILED payment SUCCESS when payment.captured arrives later", async () => {
    mockPaymentRepo.findByRazorpayOrderId.mockResolvedValue({
      ...(await mockPaymentRepo.findByRazorpayOrderId()),
      status: PaymentStatus.FAILED,
    });

    await paymentService.handleWebhook("sig", {
      event: "payment.captured",
      payload: { payment: { entity: paymentEntity } },
    });

    expect(mockPaymentRepo.markSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "pay_1", razorpayOrderId: "order_1", razorpayPaymentId: "pay_razorpay_1" }),
    );
    expect(mockParticipantService.confirmPaymentRegistration).toHaveBeenCalledWith("part_1");
  });

  // Regression: a retry replaced the row's order (order_2 is current) and the capture
  // lands on the older order_1. It must still settle the registration.
  it("settles a capture on an older order found in order history", async () => {
    mockPaymentRepo.findOrder.mockResolvedValue({
      razorpayOrderId: "order_1",
      payment: { ...(await mockPaymentRepo.findByRazorpayOrderId()), razorpayOrderId: "order_2", status: PaymentStatus.FAILED },
    });

    await paymentService.handleWebhook("sig", {
      event: "payment.captured",
      payload: { payment: { entity: paymentEntity } },
    });

    expect(mockPaymentRepo.markSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "pay_1", razorpayOrderId: "order_1" }),
    );
    expect(mockPaymentRepo.updateOrder).toHaveBeenCalledWith("order_1", expect.objectContaining({ status: PaymentStatus.SUCCESS }));
  });

  it("re-links an order missing from our DB via notes.participantId", async () => {
    const row = await mockPaymentRepo.findByRazorpayOrderId();
    mockPaymentRepo.findByRazorpayOrderId.mockResolvedValue(null);
    mockPaymentRepo.findByParticipantId.mockResolvedValue(row);

    await paymentService.handleWebhook("sig", {
      event: "payment.captured",
      payload: { payment: { entity: { ...paymentEntity, order_id: "order_lost", notes: { participantId: "part_1" } } } },
    });

    expect(mockPaymentRepo.recordOrder).toHaveBeenCalledWith({ paymentId: "pay_1", razorpayOrderId: "order_lost", amount: 10000 });
    expect(mockPaymentRepo.markSuccess).toHaveBeenCalledWith(expect.objectContaining({ razorpayOrderId: "order_lost" }));
  });

  it("does not re-run confirmation for a second capture on an already-paid registration", async () => {
    mockPaymentRepo.findByRazorpayOrderId.mockResolvedValue({
      ...(await mockPaymentRepo.findByRazorpayOrderId()),
      status: PaymentStatus.SUCCESS,
      razorpayPaymentId: "pay_first",
    });

    await paymentService.handleWebhook("sig", {
      event: "payment.captured",
      payload: { payment: { entity: paymentEntity } },
    });

    expect(mockPaymentRepo.markSuccess).not.toHaveBeenCalled();
    expect(mockParticipantService.confirmPaymentRegistration).not.toHaveBeenCalled();
    // …but the duplicate stays visible on its order for a refund.
    expect(mockPaymentRepo.updateOrder).toHaveBeenCalledWith("order_1", expect.objectContaining({ status: PaymentStatus.SUCCESS, razorpayPaymentId: "pay_razorpay_1" }));
  });
});

describe("PaymentService.handleWebhook — payment.failed", () => {
  const row = {
    id: "pay_1", organizationId: "org_1", contestId: "contest_1", participantId: "part_1",
    amount: 10000, currency: "INR", status: PaymentStatus.CREATED, razorpayOrderId: "order_current",
  };
  const failedEntity = (orderId: string) => ({
    id: "pay_rzp_x", order_id: orderId, amount: 10000, currency: "INR", status: "failed", created_at: 1,
    method: "upi", error_code: "BAD_REQUEST_ERROR", error_reason: "payment_timed_out",
    error_description: "Payment was unsuccessful as you could not complete it in time.",
  });

  let repo: any;
  let service: PaymentService;
  beforeEach(() => {
    repo = {
      findOrder: jest.fn().mockResolvedValue({ payment: row }),
      updateOrder: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    service = new PaymentService(repo, { verifyWebhookSignature: () => true } as any, {} as any, {} as any, {} as any);
  });

  it("records Razorpay's real reason on the order and fails the row when it's the current order", async () => {
    await service.handleWebhook("sig", { event: "payment.failed", payload: { payment: { entity: failedEntity("order_current") } } });

    expect(repo.updateOrder).toHaveBeenCalledWith("order_current", expect.objectContaining({
      status: PaymentStatus.FAILED, errorReason: "payment_timed_out",
      failureReason: "Payment was unsuccessful as you could not complete it in time.",
    }));
    expect(repo.markFailed).toHaveBeenCalledWith("order_current", "Payment was unsuccessful as you could not complete it in time.");
  });

  it("does not fail the row for a failure on an older order", async () => {
    await service.handleWebhook("sig", { event: "payment.failed", payload: { payment: { entity: failedEntity("order_old") } } });

    expect(repo.updateOrder).toHaveBeenCalledWith("order_old", expect.objectContaining({ status: PaymentStatus.FAILED }));
    expect(repo.markFailed).not.toHaveBeenCalled();
  });
});
