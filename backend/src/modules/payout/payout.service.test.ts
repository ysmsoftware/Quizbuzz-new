import { PayoutService } from "./payout.service";
import { RouteTransferStatus, PayoutAccountStatus } from "@prisma/client";

describe("PayoutService - Transfer History & Summary", () => {
  let payoutService: PayoutService;
  let mockPayoutRepository: any;
  let mockRazorpayProvider: any;

  beforeEach(() => {
    mockPayoutRepository = {
      listTransfersByOrgId: jest.fn(),
      getTransferSummaryByOrgId: jest.fn(),
    };

    mockRazorpayProvider = {};

    payoutService = new PayoutService(
      mockPayoutRepository,
      mockRazorpayProvider
    );
  });

  describe("listTransfers", () => {
    it("should return formatted transfer items with fee breakdown and pagination metadata", async () => {
      const mockRows = [
        {
          id: "transfer_1",
          organizationId: "org_123",
          paymentId: "pay_1",
          razorpayPaymentId: "pay_rzp_1",
          razorpayTransferId: "tr_rzp_1",
          grossAmount: 10000, // ₹100.00
          platformFeeAmount: 200, // ₹2.00 (2%)
          gatewayFeeAmount: 200, // ₹2.00 (2%)
          gstAmount: 36, // ₹0.36 (18% of gateway fee)
          transferAmount: 9564, // ₹95.64 net
          currency: "INR",
          status: RouteTransferStatus.PROCESSED,
          failureReason: null,
          processedAt: new Date("2026-07-25T10:00:00Z"),
          createdAt: new Date("2026-07-25T09:00:00Z"),
          payment: {
            contest: {
              title: "General Knowledge Cup 2026",
            },
          },
        },
      ];

      mockPayoutRepository.listTransfersByOrgId.mockResolvedValue({
        rows: mockRows,
        total: 1,
      });

      const result = await payoutService.listTransfers("org_123", {
        page: 1,
        limit: 20,
        status: "all",
      });

      expect(mockPayoutRepository.listTransfersByOrgId).toHaveBeenCalledWith("org_123", {
        page: 1,
        limit: 20,
        status: "all",
      });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.items).toHaveLength(1);

      const item = result.items[0]!;
      expect(item.id).toBe("transfer_1");
      expect(item.contestTitle).toBe("General Knowledge Cup 2026");
      expect(item.grossAmount).toBe(10000);
      expect(item.commissionAmount).toBe(200);
      expect(item.gatewayFeeAmount).toBe(200);
      expect(item.gstAmount).toBe(36);
      expect(item.totalDeducted).toBe(436);
      expect(item.transferAmount).toBe(9564);
      expect(item.status).toBe("PROCESSED");
      expect(item.razorpayTransferId).toBe("tr_rzp_1");
    });

    it("should pass status filter parameter to repository", async () => {
      mockPayoutRepository.listTransfersByOrgId.mockResolvedValue({
        rows: [],
        total: 0,
      });

      await payoutService.listTransfers("org_123", {
        page: 2,
        limit: 10,
        status: "FAILED",
      });

      expect(mockPayoutRepository.listTransfersByOrgId).toHaveBeenCalledWith("org_123", {
        page: 2,
        limit: 10,
        status: "FAILED",
      });
    });
  });

  describe("getTransferSummary", () => {
    it("should return summary metrics for organization", async () => {
      const mockSummary = {
        processed: 12,
        pending: 3,
        failed: 1,
        totalReceivedAllTime: 1250000, // ₹12,500.00
        currency: "INR",
      };

      mockPayoutRepository.getTransferSummaryByOrgId.mockResolvedValue(mockSummary);

      const result = await payoutService.getTransferSummary("org_123");

      expect(mockPayoutRepository.getTransferSummaryByOrgId).toHaveBeenCalledWith("org_123");
      expect(result).toEqual(mockSummary);
    });
  });
});

describe("PayoutService - createRouteTransferForPayment (crash/stuck-transfer recovery)", () => {
  let payoutService: PayoutService;
  let mockPayoutRepository: any;
  let mockRazorpayProvider: any;

  const activeAccount = {
    organizationId: "org_123",
    status: PayoutAccountStatus.ACTIVE,
    razorpayLinkedAccountId: "acc_linked_1",
  };

  const basePayment = {
    id: "pay_1",
    organizationId: "org_123",
    amount: 10000,
    razorpayPaymentId: "rzp_pay_1",
    currency: "INR",
  };

  beforeEach(() => {
    mockPayoutRepository = {
      findRouteTransferByPaymentId: jest.fn(),
      findPayoutAccountByOrgId: jest.fn(),
      createRouteTransfer: jest.fn(),
      updateRouteTransferStatus: jest.fn(),
    };
    mockRazorpayProvider = {
      createPaymentTransfer: jest.fn(),
    };
    payoutService = new PayoutService(mockPayoutRepository, mockRazorpayProvider);
  });

  it("does NOT call Razorpay again for a PROCESSED transfer (genuinely terminal)", async () => {
    const existing = {
      id: "transfer_1",
      status: RouteTransferStatus.PROCESSED,
      failureReason: null,
      createdAt: new Date(),
    };
    mockPayoutRepository.findRouteTransferByPaymentId.mockResolvedValue(existing);

    const result = await payoutService.createRouteTransferForPayment(basePayment);

    expect(mockRazorpayProvider.createPaymentTransfer).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it("does NOT call Razorpay again for a FAILED transfer (needs explicit retry, not an implicit one)", async () => {
    const existing = {
      id: "transfer_1",
      status: RouteTransferStatus.FAILED,
      failureReason: "Razorpay API error",
      createdAt: new Date(),
    };
    mockPayoutRepository.findRouteTransferByPaymentId.mockResolvedValue(existing);

    const result = await payoutService.createRouteTransferForPayment(basePayment);

    expect(mockRazorpayProvider.createPaymentTransfer).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it("does NOT touch a PENDING transfer that is still within the grace window (assume in-flight)", async () => {
    const existing = {
      id: "transfer_1",
      status: RouteTransferStatus.PENDING,
      failureReason: null,
      createdAt: new Date(), // just created — well within the grace window
    };
    mockPayoutRepository.findRouteTransferByPaymentId.mockResolvedValue(existing);

    const result = await payoutService.createRouteTransferForPayment(basePayment);

    expect(mockPayoutRepository.findPayoutAccountByOrgId).not.toHaveBeenCalled();
    expect(mockRazorpayProvider.createPaymentTransfer).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it("RESUMES a PENDING transfer past the grace window (interrupted prior attempt) instead of leaving it stuck", async () => {
    const existing = {
      id: "transfer_1",
      status: RouteTransferStatus.PENDING,
      failureReason: null,
      // older than PAYOUT_STUCK_TRANSFER_RESUME_AFTER_MS (default 3 minutes) — simulates
      // a worker that created the row and then crashed before calling Razorpay.
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    };
    mockPayoutRepository.findRouteTransferByPaymentId.mockResolvedValue(existing);
    mockPayoutRepository.findPayoutAccountByOrgId.mockResolvedValue(activeAccount);
    mockRazorpayProvider.createPaymentTransfer.mockResolvedValue({ id: "rzp_transfer_1" });
    mockPayoutRepository.updateRouteTransferStatus.mockResolvedValue({
      ...existing,
      status: RouteTransferStatus.PROCESSED,
    });

    const result = await payoutService.createRouteTransferForPayment(basePayment);

    // Must NOT create a second row for the same payment (paymentId is unique) —
    // it should reuse transfer_1 and drive it to PROCESSED.
    expect(mockPayoutRepository.createRouteTransfer).not.toHaveBeenCalled();
    expect(mockRazorpayProvider.createPaymentTransfer).toHaveBeenCalledTimes(1);
    expect(mockPayoutRepository.updateRouteTransferStatus).toHaveBeenCalledWith(
      "transfer_1",
      expect.objectContaining({ status: RouteTransferStatus.PROCESSED })
    );
    expect(result).toEqual(expect.objectContaining({ status: RouteTransferStatus.PROCESSED }));
  });

  it("resumes a 'no_active_payout_account' PENDING transfer once the account has since been activated", async () => {
    const existing = {
      id: "transfer_1",
      status: RouteTransferStatus.PENDING,
      failureReason: "no_active_payout_account",
      createdAt: new Date(Date.now() - 60 * 60 * 1000), // an hour ago
    };
    mockPayoutRepository.findRouteTransferByPaymentId.mockResolvedValue(existing);
    // Account is ACTIVE now, even though it wasn't when the row was first created.
    mockPayoutRepository.findPayoutAccountByOrgId.mockResolvedValue(activeAccount);
    mockRazorpayProvider.createPaymentTransfer.mockResolvedValue({ id: "rzp_transfer_2" });
    mockPayoutRepository.updateRouteTransferStatus.mockResolvedValue({
      ...existing,
      status: RouteTransferStatus.PROCESSED,
    });

    await payoutService.createRouteTransferForPayment(basePayment);

    expect(mockPayoutRepository.createRouteTransfer).not.toHaveBeenCalled();
    expect(mockRazorpayProvider.createPaymentTransfer).toHaveBeenCalledTimes(1);
    expect(mockPayoutRepository.updateRouteTransferStatus).toHaveBeenCalledWith(
      "transfer_1",
      expect.objectContaining({ status: RouteTransferStatus.PROCESSED })
    );
  });

  it("still parks as PENDING/no_active_payout_account (without duplicating the row) if the account remains inactive", async () => {
    const existing = {
      id: "transfer_1",
      status: RouteTransferStatus.PENDING,
      failureReason: "no_active_payout_account",
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
    };
    mockPayoutRepository.findRouteTransferByPaymentId.mockResolvedValue(existing);
    mockPayoutRepository.findPayoutAccountByOrgId.mockResolvedValue(null); // still no account
    mockPayoutRepository.updateRouteTransferStatus.mockResolvedValue(existing);

    await payoutService.createRouteTransferForPayment(basePayment);

    expect(mockPayoutRepository.createRouteTransfer).not.toHaveBeenCalled();
    expect(mockRazorpayProvider.createPaymentTransfer).not.toHaveBeenCalled();
    expect(mockPayoutRepository.updateRouteTransferStatus).toHaveBeenCalledWith(
      "transfer_1",
      expect.objectContaining({ status: RouteTransferStatus.PENDING, failureReason: "no_active_payout_account" })
    );
  });

  it("creates a fresh row on the very first attempt (no existing transfer)", async () => {
    mockPayoutRepository.findRouteTransferByPaymentId.mockResolvedValue(null);
    mockPayoutRepository.findPayoutAccountByOrgId.mockResolvedValue(activeAccount);
    mockPayoutRepository.createRouteTransfer.mockResolvedValue({
      id: "transfer_new",
      status: RouteTransferStatus.PENDING,
    });
    mockRazorpayProvider.createPaymentTransfer.mockResolvedValue({ id: "rzp_transfer_3" });
    mockPayoutRepository.updateRouteTransferStatus.mockResolvedValue({
      id: "transfer_new",
      status: RouteTransferStatus.PROCESSED,
    });

    await payoutService.createRouteTransferForPayment(basePayment);

    expect(mockPayoutRepository.createRouteTransfer).toHaveBeenCalledTimes(1);
    expect(mockRazorpayProvider.createPaymentTransfer).toHaveBeenCalledTimes(1);
  });
});
