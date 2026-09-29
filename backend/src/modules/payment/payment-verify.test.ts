import { PaymentService } from "./payment.service";
import { PaymentStatus } from "@prisma/client";

jest.mock("../../common/feature-flags", () => ({
  isFeatureEnabled: jest.fn(() => Promise.resolve(true)),
}));

// Admin "verify Razorpay payment": nothing but the ID comes from the admin —
// status, amount and ownership are all checked against Razorpay.
describe("PaymentService.verifyRazorpayPaymentForParticipant", () => {
  const row = {
    id: "pay_1", organizationId: "org_1", contestId: "c_1", participantId: "part_1",
    amount: 9900, currency: "INR", status: PaymentStatus.FAILED, razorpayOrderId: "order_B",
    razorpayPaymentId: null, attempts: 2, webhookConfirmed: false, failureReason: "timed out",
    paidAt: null, createdAt: new Date(), updatedAt: new Date(),
  };
  const captured = {
    id: "pay_rzp_A", order_id: "order_A", amount: 9900, currency: "INR", status: "captured",
    created_at: 1, method: "upi", email: "m@example.com", notes: { participantId: "part_1" },
  };

  let repo: any;
  let razorpay: any;
  let participants: any;
  let service: PaymentService;

  beforeEach(() => {
    repo = {
      findByParticipantId: jest.fn().mockResolvedValue(row),
      listOrders: jest.fn().mockResolvedValue([{ razorpayOrderId: "order_B", createdAt: new Date() }]),
      findByRazorpayPaymentId: jest.fn().mockResolvedValue(null),
      findOrder: jest.fn().mockResolvedValue(null),
      recordOrder: jest.fn().mockResolvedValue(undefined),
      updateOrder: jest.fn().mockResolvedValue(undefined),
      markSuccess: jest.fn().mockResolvedValue(undefined),
    };
    razorpay = {
      fetchPayment: jest.fn().mockResolvedValue(captured),
      fetchOrder: jest.fn().mockResolvedValue({ id: "order_A", receipt: "rcpt_x", notes: {} }),
      fetchOrderPayments: jest.fn().mockResolvedValue([captured]),
    };
    participants = {
      confirmPaymentRegistration: jest.fn().mockResolvedValue(undefined),
      getParticipantById: jest.fn().mockResolvedValue({ contact: { firstName: "M" }, contest: { title: "Q", slug: "q" } }),
    };
    service = new PaymentService(repo, razorpay, {} as any, participants, { enqueueMessage: jest.fn() } as any);
  });

  const verify = (reference: string, organizationId = "org_1") =>
    service.verifyRazorpayPaymentForParticipant({ participantId: "part_1", organizationId, reference });

  it("settles the registration from a captured payment that belongs to this participant", async () => {
    await verify("pay_rzp_A");

    expect(repo.recordOrder).toHaveBeenCalledWith({ paymentId: "pay_1", razorpayOrderId: "order_A", amount: 9900 });
    expect(repo.markSuccess).toHaveBeenCalledWith(expect.objectContaining({ paymentId: "pay_1", razorpayPaymentId: "pay_rzp_A" }));
    expect(participants.confirmPaymentRegistration).toHaveBeenCalledWith("part_1");
  });

  it("accepts an order ID and uses its captured attempt", async () => {
    await verify("order_A");
    expect(repo.markSuccess).toHaveBeenCalledWith(expect.objectContaining({ razorpayPaymentId: "pay_rzp_A" }));
  });

  it("rejects a payment that is not captured", async () => {
    razorpay.fetchPayment.mockResolvedValue({ ...captured, status: "failed", error_description: "Payment timed out" });
    await expect(verify("pay_rzp_A")).rejects.toThrow(/"failed".*Payment timed out/);
    expect(repo.markSuccess).not.toHaveBeenCalled();
  });

  it("rejects an amount mismatch", async () => {
    razorpay.fetchPayment.mockResolvedValue({ ...captured, amount: 100 });
    await expect(verify("pay_rzp_A")).rejects.toThrow(/Amount mismatch/);
  });

  it("rejects someone else's payment", async () => {
    razorpay.fetchPayment.mockResolvedValue({ ...captured, notes: { participantId: "part_OTHER" } });
    await expect(verify("pay_rzp_A")).rejects.toThrow(/different registration/);
    expect(repo.markSuccess).not.toHaveBeenCalled();
  });

  it("rejects a payment already linked to another registration", async () => {
    repo.findByRazorpayPaymentId.mockResolvedValue({ id: "pay_other" });
    await expect(verify("pay_rzp_A")).rejects.toThrow(/already linked/);
  });

  // Step 1 of the admin flow: show what Razorpay has, change nothing.
  it("preview returns Razorpay's details and checks without writing or emailing", async () => {
    const preview = await service.previewRazorpayPaymentForParticipant({ participantId: "part_1", organizationId: "org_1", reference: "pay_rzp_A" });

    expect(preview.canConfirm).toBe(true);
    expect(preview.razorpay).toMatchObject({ paymentId: "pay_rzp_A", orderId: "order_A", status: "captured", amount: 9900 });
    expect(preview.checks.every((c) => c.ok)).toBe(true);
    expect(repo.recordOrder).not.toHaveBeenCalled();
    expect(repo.markSuccess).not.toHaveBeenCalled();
    expect(participants.confirmPaymentRegistration).not.toHaveBeenCalled();
  });

  it("preview reports failing checks instead of throwing", async () => {
    razorpay.fetchPayment.mockResolvedValue({ ...captured, status: "failed", error_description: "Payment timed out" });

    const preview = await service.previewRazorpayPaymentForParticipant({ participantId: "part_1", organizationId: "org_1", reference: "pay_rzp_A" });

    expect(preview.canConfirm).toBe(false);
    expect(preview.checks.find((c) => c.label === "Captured by Razorpay")).toMatchObject({ ok: false });
  });

  it("does not expose another organization's registration", async () => {
    await expect(verify("pay_rzp_A", "org_2")).rejects.toThrow(/No payment record/);
    expect(razorpay.fetchPayment).not.toHaveBeenCalled();
  });
});
