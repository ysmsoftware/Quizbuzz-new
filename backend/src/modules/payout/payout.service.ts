import { PayoutRepository } from "./payout.repository";
import { RazorpayProvider } from "../../providers/razorpay.provider";
import { config } from "../../config";
import logger from "../../config/logger";
import { BadRequestError, NotFoundError } from "../../error/http-errors";
import { PayoutAccountStatus, PayoutOnboardingMode, RouteTransferStatus, Prisma } from "@prisma/client";
import { SetupPayoutAccountInput, PayoutTransferItem, PayoutTransferSummary } from "./payout.types";
import { MessagingService } from "../messaging/messaging.service";
import { MessageTemplate } from "../../types/message-template.enum";

/**
 * Fee breakdown for a single Route transfer.
 *
 * Two categories, never merged:
 *  - commissionAmount: QuizBuzz's own cut (config.payout.commissionPercent).
 *  - gatewayFeeAmount + gstAmount: Razorpay's mandatory pass-through cost
 *    (config.payout.gatewayFeePercent + GST on that fee). This is not platform
 *    revenue — it must always be deducted or the platform absorbs Razorpay's
 *    settlement cut as a loss.
 */
interface FeeBreakdown {
  grossAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  gatewayFeePercent: number;
  gatewayFeeAmount: number;
  gstPercent: number;
  gstAmount: number;
  totalDeducted: number;
  transferAmount: number;
}

function computeFeeBreakdown(grossAmount: number): FeeBreakdown {
  const commissionPercent = config.payout.commissionPercent;
  const gatewayFeePercent = config.payout.gatewayFeePercent;
  const gstPercent = config.payout.gstOnFeePercent;

  const commissionAmount = Math.round((grossAmount * commissionPercent) / 100);
  const gatewayFeeAmount = Math.round((grossAmount * gatewayFeePercent) / 100);
  // GST applies to the gateway fee itself, not to the gross payment.
  const gstAmount = Math.round((gatewayFeeAmount * gstPercent) / 100);

  const totalDeducted = commissionAmount + gatewayFeeAmount + gstAmount;
  const transferAmount = grossAmount - totalDeducted;

  return {
    grossAmount,
    commissionPercent,
    commissionAmount,
    gatewayFeePercent,
    gatewayFeeAmount,
    gstPercent,
    gstAmount,
    totalDeducted,
    transferAmount,
  };
}

function paise(amount: number): string {
  return `₹${(amount / 100).toFixed(2)}`;
}

export class PayoutService {
  constructor(
    private payoutRepository: PayoutRepository,
    private razorpayProvider: RazorpayProvider,
    private messagingService?: MessagingService
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

  async listTransfers(
    organizationId: string,
    params: { page: number; limit: number; status: string }
  ): Promise<{ items: PayoutTransferItem[]; total: number; page: number; limit: number }> {
    const { rows, total } = await this.payoutRepository.listTransfersByOrgId(organizationId, params);

    const items: PayoutTransferItem[] = rows.map((row: any) => {
      const commissionPercent = config.payout.commissionPercent;
      const gatewayFeePercent = config.payout.gatewayFeePercent;
      const gstPercent = config.payout.gstOnFeePercent;
      const totalDeducted = row.platformFeeAmount + row.gatewayFeeAmount + row.gstAmount;
      const contestTitle = row.payment?.contest?.title || "N/A";

      return {
        id: row.id,
        contestTitle,
        grossAmount: row.grossAmount,
        commissionPercent,
        commissionAmount: row.platformFeeAmount,
        gatewayFeePercent,
        gatewayFeeAmount: row.gatewayFeeAmount,
        gstPercent,
        gstAmount: row.gstAmount,
        totalDeducted,
        transferAmount: row.transferAmount,
        currency: row.currency,
        status: row.status,
        failureReason: row.failureReason,
        razorpayTransferId: row.razorpayTransferId,
        processedAt: row.processedAt ? row.processedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      };
    });

    return { items, total, page: params.page, limit: params.limit };
  }

  async getTransferSummary(organizationId: string): Promise<PayoutTransferSummary> {
    return this.payoutRepository.getTransferSummaryByOrgId(organizationId);
  }

  /** Reconciliation sweep support — see PaymentService.reconcileStuckTransfers. */
  async findStuckPendingTransfers(olderThanMs: number) {
    return this.payoutRepository.findStuckPendingTransfers(olderThanMs);
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

  /**
   * Decides what to do with a PaymentRouteTransfer row that already exists for this
   * payment. A row existing does NOT automatically mean "already handled" — a PENDING
   * row can mean several different things, and treating all of them as terminal is
   * what previously let a crashed/stalled worker attempt permanently strand a transfer
   * (BullMQ's own crash-recovery redelivery would hit this same check and bail out
   * without ever calling Razorpay again).
   */
  private classifyExistingTransfer(
    existingTransfer: NonNullable<Awaited<ReturnType<PayoutRepository["findRouteTransferByPaymentId"]>>>,
    opts?: { forceRetry?: boolean | undefined }
  ): "terminal" | "still-no-account" | "possibly-in-flight" | "resumable" {
    if (
      existingTransfer.status === RouteTransferStatus.PROCESSED ||
      existingTransfer.status === RouteTransferStatus.REVERSED
    ) {
      // Already completed — never re-transfer, not even on an explicit forced retry.
      // Retrying a PROCESSED transfer would mean paying the org twice for the same payment.
      return "terminal";
    }

    if (existingTransfer.status === RouteTransferStatus.FAILED) {
      // Razorpay's API itself rejected the transfer — don't auto-retry that in a hot
      // loop from every queue redelivery. Only resume when a human has explicitly
      // requested a retry (ops dashboard action, after looking at why it failed).
      return opts?.forceRetry ? "resumable" : "terminal";
    }

    // status === PENDING from here on.
    if (existingTransfer.failureReason === "no_active_payout_account") {
      // Legitimate wait — but the account may have been linked/reactivated since this
      // row was created, so the caller re-checks current account status rather than
      // trusting this stale row.
      return "still-no-account";
    }

    if (opts?.forceRetry) {
      // Explicit human action — skip the grace-window wait too.
      return "resumable";
    }

    const ageMs = Date.now() - new Date(existingTransfer.createdAt).getTime();
    if (ageMs < config.payout.stuckTransferResumeAfterMs) {
      // No failure reason recorded yet and still within the grace window — assume a
      // prior attempt (this call itself, a concurrent one, or one BullMQ hasn't yet
      // detected as stalled) is genuinely in flight. Don't step on it.
      return "possibly-in-flight";
    }

    // PENDING, no failure reason, older than the grace window: almost certainly an
    // interrupted prior attempt (process crash/restart between row creation and the
    // Razorpay call completing). Safe to resume using the existing row.
    return "resumable";
  }

  async createRouteTransferForPayment(
    payment: {
      id: string;
      organizationId: string;
      amount: number;
      razorpayPaymentId: string | null;
      currency?: string;
    },
    opts?: { forceRetry?: boolean | undefined }
  ) {
    if (!payment.razorpayPaymentId) {
      logger.warn("Skipping payout transfer: missing razorpayPaymentId", { paymentId: payment.id });
      return null;
    }

    // 1. Idempotency check — but see classifyExistingTransfer: a row existing isn't
    // automatically "done", so this no longer short-circuits unconditionally.
    const existingTransfer = await this.payoutRepository.findRouteTransferByPaymentId(payment.id);

    if (existingTransfer) {
      const classification = this.classifyExistingTransfer(existingTransfer, opts);

      if (classification === "terminal") {
        logger.info("Payout transfer already resolved for payment", {
          paymentId: payment.id,
          status: existingTransfer.status,
        });
        return existingTransfer;
      }

      if (classification === "possibly-in-flight") {
        logger.info("Payout transfer is PENDING and recent — assuming another attempt is in flight, not resuming", {
          paymentId: payment.id,
          transferId: existingTransfer.id,
        });
        return existingTransfer;
      }

      if (classification === "resumable") {
        logger.warn(
          opts?.forceRetry
            ? "Retrying a transfer at explicit human request"
            : "Resuming a stuck PENDING transfer past the grace window — likely an interrupted prior attempt",
          { paymentId: payment.id, transferId: existingTransfer.id, previousStatus: existingTransfer.status }
        );
      }
      // "still-no-account" and "resumable" both fall through to the checks below,
      // reusing the existing row instead of creating a new one.
    }

    const fees = computeFeeBreakdown(payment.amount);
    const { grossAmount, transferAmount } = fees;
    const platformFeeAmount = fees.commissionAmount;
    const { gatewayFeeAmount, gstAmount } = fees;
    const currency = payment.currency || "INR";

    // 2. Fetch org payout account (always fresh — never trust the account status
    // implied by an existing row, since it may have changed since that row was written).
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

      if (existingTransfer) {
        // Update the row in place — paymentId is unique, we can't insert a duplicate.
        return this.payoutRepository.updateRouteTransferStatus(existingTransfer.id, {
          status: RouteTransferStatus.PENDING,
          failureReason: "no_active_payout_account",
        });
      }

      const { row } = await this.createTransferRow(payment.id, {
        organizationId: payment.organizationId,
        paymentId: payment.id,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpayLinkedAccountId: payoutAccount?.razorpayLinkedAccountId ?? undefined,
        grossAmount,
        platformFeeAmount,
        gatewayFeeAmount,
        gstAmount,
        transferAmount,
        currency,
        status: RouteTransferStatus.PENDING,
        failureReason: "no_active_payout_account",
      });
      return row;
    }

    // 3. Create (or reuse) the initial transfer record in PENDING state
    let transferRecord = existingTransfer;
    if (!transferRecord) {
      const { row, isNew } = await this.createTransferRow(payment.id, {
        organizationId: payment.organizationId,
        paymentId: payment.id,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpayLinkedAccountId: payoutAccount.razorpayLinkedAccountId,
        grossAmount,
        platformFeeAmount,
        gatewayFeeAmount,
        gstAmount,
        transferAmount,
        currency,
        status: RouteTransferStatus.PENDING,
      });

      // A concurrent webhook delivery already created (and is driving) this transfer —
      // don't call Razorpay's transfer API a second time for the same payment.
      if (!isNew) {
        return row;
      }
      transferRecord = row;
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
          grossAmount: paise(grossAmount),
          commissionPercent: `${fees.commissionPercent}%`,
          commissionAmount: paise(platformFeeAmount),
          gatewayFeePercent: `${fees.gatewayFeePercent}%`,
          gatewayFeeAmount: paise(gatewayFeeAmount),
          gstPercent: `${fees.gstPercent}%`,
          gstAmount: paise(gstAmount),
          transferAmount: paise(transferAmount),
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
        grossAmount,
        commissionAmount: platformFeeAmount,
        gatewayFeeAmount,
        gstAmount,
        transferAmount,
      });

      this.sendTransferBreakdownEmail(payoutAccount, fees, razorpayTransferId).catch((err) => {
        logger.error("Failed to enqueue payout breakdown email", {
          paymentId: payment.id,
          err: (err as Error).message,
        });
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

  /**
   * Notifies the org/vendor of exactly what landed in their linked account and why —
   * full breakdown of commission vs. the mandatory Razorpay gateway fee + GST, so it's
   * never a mystery why the transfer is less than the gross payment.
   */
  private async sendTransferBreakdownEmail(
    payoutAccount: { accountEmail: string; accountName: string; organizationId: string },
    fees: FeeBreakdown,
    razorpayTransferId: string | null
  ): Promise<void> {
    if (!this.messagingService) {
      return;
    }
    if (!payoutAccount.accountEmail) {
      return;
    }

    await this.messagingService.enqueueMessage(payoutAccount.organizationId, {
      channel: "EMAIL",
      template: MessageTemplate.PAYOUT_TRANSFER_CONFIRMATION,
      recipient: payoutAccount.accountEmail,
      params: {
        name: payoutAccount.accountName,
        grossAmount: paise(fees.grossAmount),
        commissionPercent: `${fees.commissionPercent}%`,
        commissionAmount: paise(fees.commissionAmount),
        gatewayFeePercent: `${fees.gatewayFeePercent}%`,
        gatewayFeeAmount: paise(fees.gatewayFeeAmount),
        gstPercent: `${fees.gstPercent}%`,
        gstAmount: paise(fees.gstAmount),
        totalDeducted: paise(fees.totalDeducted),
        transferAmount: paise(fees.transferAmount),
        transferId: razorpayTransferId ?? "pending",
      },
    });
  }
}
