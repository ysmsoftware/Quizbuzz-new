import { PayoutRepository } from "./payout.repository";
import { RazorpayProvider } from "../../providers/razorpay.provider";
import { config } from "../../config";
import logger from "../../config/logger";
import { BadRequestError, NotFoundError } from "../../error/http-errors";
import { PayoutAccountStatus, PayoutOnboardingMode, RouteTransferStatus, Prisma } from "@prisma/client";
import { SetupPayoutAccountInput } from "./payout.types";

export class PayoutService {
  constructor(
    private payoutRepository: PayoutRepository,
    private razorpayProvider: RazorpayProvider
  ) {}

  async setupPayoutAccount(organizationId: string, input: SetupPayoutAccountInput) {
    const onboardingMode = config.payout.onboardingMode as PayoutOnboardingMode;

    let razorpayLinkedAccountId: string | undefined = undefined;
    let status: PayoutAccountStatus = PayoutAccountStatus.PENDING;

    if (onboardingMode === PayoutOnboardingMode.API && config.payout.enabled) {
      try {
        const result = await this.razorpayProvider.createLinkedAccount({
          email: input.accountEmail,
          phone: input.contactNumber,
          legal_business_name: input.accountName,
          business_type: "individual",
          contact_name: input.accountName,
          profile: {
            category: "education",
            subcategory: "coaching",
          },
        });
        razorpayLinkedAccountId = result.id;
        status = PayoutAccountStatus.ACTIVE;
      } catch (err: any) {
        logger.error("Failed to auto-create Razorpay linked account via API", { err: err?.message, organizationId });
        // fallback to PENDING manual mode
      }
    }

    const account = await this.payoutRepository.upsertPayoutAccount({
      organizationId,
      accountName: input.accountName,
      accountEmail: input.accountEmail,
      contactNumber: input.contactNumber,
      razorpayLinkedAccountId,
      status,
      onboardingMode,
    });

    logger.info("Payout account setup initiated", { organizationId, status, onboardingMode });
    return account;
  }

  async attachLinkedAccount(organizationId: string, razorpayLinkedAccountId: string) {
    const existing = await this.payoutRepository.findPayoutAccountByOrgId(organizationId);
    if (!existing) {
      throw new NotFoundError("Payout account record not found. Please submit payout details first.");
    }

    const linkedAccount = await this.payoutRepository.updatePayoutAccountStatus(organizationId, {
      status: PayoutAccountStatus.ACTIVE,
      razorpayLinkedAccountId,
      activatedAt: new Date(),
    });

    logger.info("Razorpay linked account attached manually", { organizationId, razorpayLinkedAccountId });
    return linkedAccount;
  }

  async getPayoutAccount(organizationId: string) {
    const account = await this.payoutRepository.findPayoutAccountByOrgId(organizationId);
    if (!account) {
      return {
        status: PayoutAccountStatus.PENDING,
        hasAccount: false,
        account: null,
      };
    }
    return {
      status: account.status,
      hasAccount: true,
      account,
    };
  }

  async listTransfers(organizationId: string) {
    return this.payoutRepository.listTransfersByOrgId(organizationId);
  }

  /**
   * Creates a PaymentRouteTransfer row, tolerating the race where Razorpay
   * redelivers the same webhook concurrently (documented behavior on their end).
   * `paymentId` is @unique on this table, so a concurrent duplicate insert fails
   * with Prisma P2002 — that's not a real error, it means the other delivery won,
   * so we just look up and return whatever it created instead of surfacing it as
   * a failure.
   */
  private async createTransferRow(
    paymentId: string,
    data: Parameters<PayoutRepository["createRouteTransfer"]>[0]
  ): Promise<{ row: Awaited<ReturnType<PayoutRepository["createRouteTransfer"]>>; isNew: boolean }> {
    try {
      const row = await this.payoutRepository.createRouteTransfer(data);
      return { row, isNew: true };
    } catch (err: any) {
      const isUniqueConstraintViolation =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

      if (isUniqueConstraintViolation) {
        logger.info("Route transfer row already created by a concurrent webhook delivery", { paymentId });
        const existing = await this.payoutRepository.findRouteTransferByPaymentId(paymentId);
        if (existing) {
          return { row: existing, isNew: false };
        }
      }
      throw err;
    }
  }

  async createRouteTransferForPayment(payment: {
    id: string;
    organizationId: string;
    amount: number;
    razorpayPaymentId: string | null;
    currency?: string;
  }) {
    if (!payment.razorpayPaymentId) {
      logger.warn("Skipping payout transfer: missing razorpayPaymentId", { paymentId: payment.id });
      return null;
    }

    // 1. Idempotency check
    const existingTransfer = await this.payoutRepository.findRouteTransferByPaymentId(payment.id);
    if (existingTransfer) {
      logger.info("Payout transfer already exists for payment", { paymentId: payment.id, status: existingTransfer.status });
      return existingTransfer;
    }

    const grossAmount = payment.amount;
    const commissionPercent = config.payout.commissionPercent || 10;
    const platformFeeAmount = Math.round((grossAmount * commissionPercent) / 100);
    const transferAmount = grossAmount - platformFeeAmount;
    const currency = payment.currency || "INR";

    // 2. Fetch org payout account
    const payoutAccount = await this.payoutRepository.findPayoutAccountByOrgId(payment.organizationId);

    if (
      !payoutAccount ||
      payoutAccount.status !== PayoutAccountStatus.ACTIVE ||
      !payoutAccount.razorpayLinkedAccountId
    ) {
      logger.warn("No active payout account for org, recording pending transfer", {
        organizationId: payment.organizationId,
        paymentId: payment.id,
      });

      const { row } = await this.createTransferRow(payment.id, {
        organizationId: payment.organizationId,
        paymentId: payment.id,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpayLinkedAccountId: payoutAccount?.razorpayLinkedAccountId ?? undefined,
        grossAmount,
        platformFeeAmount,
        transferAmount,
        currency,
        status: RouteTransferStatus.PENDING,
        failureReason: "no_active_payout_account",
      });
      return row;
    }

    // 3. Create initial transfer record in PENDING state
    const { row: transferRecord, isNew } = await this.createTransferRow(payment.id, {
      organizationId: payment.organizationId,
      paymentId: payment.id,
      razorpayPaymentId: payment.razorpayPaymentId,
      razorpayLinkedAccountId: payoutAccount.razorpayLinkedAccountId,
      grossAmount,
      platformFeeAmount,
      transferAmount,
      currency,
      status: RouteTransferStatus.PENDING,
    });

    // A concurrent webhook delivery already created (and is driving) this transfer —
    // don't call Razorpay's transfer API a second time for the same payment.
    if (!isNew) {
      return transferRecord;
    }

    // 4. Trigger Razorpay Payment Transfer API
    try {
      logger.info("Executing Razorpay payment transfer", {
        paymentId: payment.id,
        razorpayPaymentId: payment.razorpayPaymentId,
        account: payoutAccount.razorpayLinkedAccountId,
        amount: transferAmount,
      });

      const response = await this.razorpayProvider.createPaymentTransfer({
        razorpayPaymentId: payment.razorpayPaymentId,
        account: payoutAccount.razorpayLinkedAccountId,
        amount: transferAmount,
        currency,
        notes: {
          paymentId: payment.id,
          organizationId: payment.organizationId,
        },
      });

      // Extract transfer ID from Razorpay API response
      const razorpayTransferId =
        Array.isArray((response as any)?.items) && (response as any).items.length > 0
          ? (response as any).items[0].id
          : (response as any)?.id || null;

      const updated = await this.payoutRepository.updateRouteTransferStatus(transferRecord.id, {
        status: RouteTransferStatus.PROCESSED,
        razorpayTransferId,
        processedAt: new Date(),
        metadata: response as any,
      });

      logger.info("Razorpay payment transfer processed successfully", {
        paymentId: payment.id,
        transferId: updated.id,
        razorpayTransferId,
      });

      return updated;
    } catch (err: any) {
      logger.error("Failed to execute Razorpay payment transfer", {
        paymentId: payment.id,
        err: err?.message || err,
      });

      return this.payoutRepository.updateRouteTransferStatus(transferRecord.id, {
        status: RouteTransferStatus.FAILED,
        failureReason: err?.message || "Razorpay API error",
      });
    }
  }
}
