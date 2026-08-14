import { Payment, PaymentStatus, Prisma } from "@prisma/client";
import { IPaymentRepository } from "./payment.repository";
import { RazorpayProvider } from '../../providers/razorpay.provider';
import { ContestService } from "../contest/contest.service";
import { ParticipantService } from "../participant/participant.service";
import { MessagingService } from "../messaging/messaging.service";
import { BadRequestError, ForbiddenError, NotFoundError, FeatureUnavailableError } from "../../error/http-errors";
import { isFeatureEnabled } from "../../common/feature-flags";
import { MessageTemplate } from "../../types/message-template.enum";
import logger from "../../config/logger";


import { PaymentListResult, PaymentDetailResult } from "./payment.types";
import { PayoutService } from "../payout/payout.service";
import { routeTransferQueue, RouteTransferJobPayload, paymentCleanupQueue } from "../../queues";
import { config } from "../../config";
import { logAudit } from "../../common/audit-log";


export class PaymentService {

    constructor(
        private paymentRepo: IPaymentRepository,
        private razorpay: RazorpayProvider,
        private contestService: ContestService,
        private participantService: ParticipantService,
        private messagingService: MessagingService,
        private payoutService?: PayoutService,
    ) { }


    async createOrder(params: { contestId: string, participantId: string }): Promise<{
        orderId: string,
        amount: number,
        currency: string,
        keyId: string,
        paymentId: string,
    }> {
        const participant = await this.participantService.getParticipantById(params.contestId, params.participantId,);
        if (!participant) {
            throw new NotFoundError("No participant found");
        }

        const contest = await this.contestService.getContest(participant.contestId, participant.organizationId);
        if (!contest) {
            throw new NotFoundError("No contest found");
        }

        // Razorpay kill switch / per-org gate (razorpay_gateway_active flag).
        if (!(await isFeatureEnabled("razorpay_gateway_active", { organizationId: participant.organizationId }))) {
            throw new FeatureUnavailableError(
                "razorpay_gateway_active",
                "Payments are temporarily unavailable for this organization. Please try again shortly."
            );
        }

        if (!contest.paymentEnabled) {
            throw new BadRequestError("This contest is not payable");
        }


        const paymentConfig = contest.paymentConfig;
        if (!paymentConfig || !paymentConfig.amount) {
            throw new BadRequestError("Invalid payment configuration for this contest");
        }

        const amount = paymentConfig.amount * 100 // paise
        const currency = (paymentConfig.currency || 'INR').toUpperCase();

        const existingOrder = await this.paymentRepo.findByParticipantId(params.participantId);

        if (existingOrder?.status === "SUCCESS") {
            throw new BadRequestError("Payment already completed");
        }

        if (existingOrder && existingOrder.razorpayOrderId) {
            const ageMs = Date.now() - existingOrder.createdAt.getTime();
            if (existingOrder.status !== "FAILED" && ageMs < config.payment.orderReuseWindowMs) {
                return {
                    orderId: existingOrder.razorpayOrderId,
                    amount: existingOrder.amount,
                    currency: existingOrder.currency,
                    keyId: this.razorpay.getPublicKey(),
                    paymentId: existingOrder.id
                };
            }

            // Existing order is either FAILED or older than the reuse window — refresh order in-place
            const retryReceiptSuffix = params.participantId.replace(/-/g, "").slice(0, 27);
            const order = await this.razorpay.createOrder({
                amount,
                currency,
                receipt: `rcpt_r_${retryReceiptSuffix}`,
                notes: {
                    participantId: params.participantId,
                    contestId: contest.id,
                    retry: "true",
                }
            });

            const updatedPayment = await this.paymentRepo.updateForRetry({
                participantId: params.participantId,
                razorpayOrderId: order.id
            });

            return {
                orderId: order.id,
                amount,
                currency,
                keyId: this.razorpay.getPublicKey(),
                paymentId: updatedPayment.id
            };
        }

        const receiptSuffix = params.participantId.replace(/-/g, "").slice(0, 30);
        const order = await this.razorpay.createOrder({
            amount,
            currency,
            receipt: `rcpt_${receiptSuffix}`,
            notes: {
                participantId: params.participantId,
                contestId: contest.id,
                contestName: contest.title
            }
        });

        // Store payment in DB
        const createdPayment = await this.paymentRepo.create({
            organizationId: contest.organizationId,
            contestId: contest.id,
            participantId: params.participantId,
            contactId: participant.contactId,
            amount,
            currency,
            razorpayOrderId: order.id,
        });


        return {
            orderId: order.id,
            amount,
            currency,
            keyId: this.razorpay.getPublicKey(),
            paymentId: createdPayment.id
        }


    }

    async verifyPayment(params: { razorpayPaymentId: string, razorpayOrderId: string, razorpaySignature: string }): Promise<void> {
        try {

            const isVerified = await this.razorpay.verifyPaymentSignature(params);
            if (!isVerified) {
                throw new BadRequestError("Payment signature does not match");
            }

            const payment = await this.paymentRepo.findByRazorpayPaymentId(params.razorpayPaymentId);
            if (!payment) {
                throw new NotFoundError("Payment not found");
            }

            if (payment.status === PaymentStatus.SUCCESS) {
                return
            }
            if (payment.status === PaymentStatus.FAILED) {
                return
            }

            await this.paymentRepo.markPending(params.razorpayOrderId);

        } catch (error) {
            logger.error("Failed to verify Payment:", error);
            throw error instanceof BadRequestError
                ? error
                : new BadRequestError(`Payment  verification failed: ${error instanceof Error ? error.message : "Unknow error"}`);
        }
    }


    /**
     * Webhook-as-source-of-truth polling endpoint.
     * The frontend calls this repeatedly after the Razorpay modal closes
     * (on all devices — including mobile UPI redirects and iOS where deep-link
     * return is not guaranteed). The webhook has already written the real
     * status to the DB; this just reflects it.
     *
     * Returns:
     *   status: SUCCESS | FAILED | PENDING | CREATED
     *   webhookConfirmed: boolean  — true only when webhook has fired
     */
    async checkPaymentStatus(participantId: string): Promise<{
        status: PaymentStatus;
        webhookConfirmed: boolean;
        failureReason: string | null;
    }> {
        const payment = await this.paymentRepo.findByParticipantId(participantId);
        if (!payment) {
            throw new NotFoundError("Payment record not found for this participant");
        }
        return {
            status: payment.status,
            webhookConfirmed: payment.webhookConfirmed,
            failureReason: payment.failureReason,
        };
    }

    async handleWebhook(
        signature: string,
        payload: any
    ): Promise<void> {

        const isValid = this.razorpay.verifyWebhookSignature(payload, signature);

        if (!isValid) {
            throw new BadRequestError("Invalid webhook signature");
        }

        const parsed = Buffer.isBuffer(payload)
            ? JSON.parse(payload.toString("utf8"))
            : typeof payload === "string"
                ? JSON.parse(payload)
                : payload

        const event = parsed.event;

        // only handle payment events
        if (!event?.startsWith("payment.")) {
            return;
        }

        const paymentEntity = parsed.payload?.payment?.entity;
        if (!paymentEntity) {
            return;
        }

        const razorpayOrderId = paymentEntity.order_id;
        if (!razorpayOrderId) {
            return;
        }


        const payment = await this.paymentRepo.findByRazorpayOrderId(razorpayOrderId);
        if (!payment) {
            logger.warn("Webhook received for unknown order:", { razorpayOrderId });
            return; // order not found in our sys 
        }

        if (payment.amount !== paymentEntity.amount) {
            logger.error("Amounr mismatch in webhook", {
                dbAmount: payment.amount,
                razorpayAmount: paymentEntity.amount,
                orderId: razorpayOrderId
            });
            return;
        }

        switch (event) {
            case "payment.captured":
                if (payment.status === "SUCCESS") { // idempotent
                    return;
                }
                if (payment.status === "FAILED") { //  no downgrade from failed
                    return;
                }

                // markSuccess's WHERE clause now guards on status !== SUCCESS too (see
                // payment.repository.ts) — this closes the race where two concurrent
                // webhook redeliveries both read PENDING above before either writes. The
                // check above is a fast-path optimism check, not the actual guarantee;
                // this try/catch around the real DB write is. If a concurrent delivery
                // already won (Prisma P2025 — the WHERE clause matched zero rows because
                // status flipped to SUCCESS between our read and our write), stop here:
                // the winning delivery already handled registration confirmation, the
                // email, and the transfer enqueue — running them again would duplicate
                // side effects for no benefit.
                try {
                    await this.paymentRepo.markSuccess({
                        razorpayOrderId,
                        razorpayPaymentId: paymentEntity.id,
                        paidAt: new Date(paymentEntity.created_at * 1000),
                        metadata: {
                            event: parsed.event,
                            paymentId: paymentEntity.id,
                            method: paymentEntity.method,
                            email: paymentEntity.email,
                            contact: paymentEntity.contact
                        }
                    });
                } catch (err: any) {
                    const lostRace =
                        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
                    if (lostRace) {
                        logger.info("[payment] Concurrent webhook delivery already marked this payment SUCCESS — skipping duplicate processing", {
                            razorpayOrderId,
                            paymentId: payment.id,
                        });
                        return;
                    }
                    throw err;
                }

                logAudit({
                    action: "payment.captured",
                    targetType: "PAYMENT",
                    targetId: payment.id,
                    targetLabel: `₹${(payment.amount / 100).toFixed(2)} ${payment.currency}`,
                    organizationId: payment.organizationId,
                    actorType: "WEBHOOK",
                    actorLabel: "Razorpay webhook",
                    metadata: { razorpayOrderId, razorpayPaymentId: paymentEntity.id, method: paymentEntity.method },
                });

                // Confirm the participant's seat: PENDING_PAYMENT → REGISTERED
                // This is the source-of-truth gate for paid contests.
                if (payment.participantId) {
                    await this.participantService.confirmPaymentRegistration(payment.participantId);
                    logger.info(`[payment] Confirmed registration for participant ${payment.participantId} after payment captured`);
                }

                // Send payment confirmation email
                if (payment.participantId) {
                    this.messagingService.enqueueMessage(payment.organizationId, {
                        participantId: payment.participantId,
                        contestId: payment.contestId ?? undefined,
                        channel: "EMAIL",
                        template: MessageTemplate.PAYMENT_CONFIRMATION_MESSAGE,
                        recipient: paymentEntity.email ?? '',
                        params: {
                            name: paymentEntity.contact ?? 'Participant',
                            amount: `₹${(payment.amount / 100).toFixed(2)}`,
                            eventName: payment.contestId ?? 'Contest',
                        },
                    }).catch((err) => {
                        logger.error(`[payment] Failed to enqueue payment confirmation: ${(err as Error).message}`);
                    });
                }
                break;

            case "payment.failed":
                if (payment.status === "SUCCESS") {
                    return;
                }
                await this.paymentRepo.markFailed(
                    razorpayOrderId,
                    paymentEntity.error_description || "Payment failed"
                );
                break;

            default:
                break;
        }


    }


    async retryPayment(participantId: string, contestId: string, organizationId: string): Promise<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
    }> {

        const participant = await this.participantService.getParticipantById(contestId, participantId, organizationId);
        if (!participant) {
            throw new NotFoundError("Participant not found");
        }

        const contest = await this.contestService.getContest(participant.contestId, organizationId);
        if (!contest) {
            throw new NotFoundError("Contest not found");
        }

        if (!contest.paymentEnabled) {
            throw new BadRequestError("Payment not enabled for this contest");
        }

        const payment = await this.paymentRepo.findByParticipantId(participantId);
        if (!payment) {
            throw new NotFoundError("Payment not found");
        }

        // Retry only if FAILED
        if (payment.status !== "FAILED") {
            throw new BadRequestError("Payment retry allowed only for failed payments");
        }

        const config = contest.paymentConfig;
        if (!config?.amount) {
            throw new BadRequestError("Invalid payment configuration");
        }

        const amount = config.amount * 100;
        const currency = (config.currency || "INR").toUpperCase();

        // create order
        // Receipt must be <= 40 chars (Razorpay limit)
        const retryReceiptSuffix = participantId.replace(/-/g, "").slice(0, 27)
        const order = await this.razorpay.createOrder({
            amount,
            currency,
            receipt: `rcpt_r_${retryReceiptSuffix}`,
            notes: {
                participantId,
                contestId: contest.id,
                retry: "true",
            }
        });

        // update existing record
        await this.paymentRepo.updateForRetry({
            participantId,
            razorpayOrderId: order.id
        });

        return {
            orderId: order.id,
            amount,
            currency,
            keyId: this.razorpay.getPublicKey()
        };


    }


    async cancelPayment(paymentId: string, organizationId?: string): Promise<void> {

        const payment = await this.paymentRepo.findById(paymentId);
        if (!payment) {
            throw new NotFoundError("Payment not found");
        }

        if (payment.status === "SUCCESS") {
            throw new BadRequestError("Cannot cancel a successful payment");
        }

        if (payment.status === "CANCELLED") {
            return;
        }
        await this.paymentRepo.markCancelled(paymentId);
    }

    async getPaymentById(paymentId: string, organizationId?: string): Promise<PaymentDetailResult> {

        const payment = await this.paymentRepo.findById(paymentId);
        if (!payment) {
            throw new NotFoundError("Payment record not found");
        }

        return {
            payment: {
                organizationId: payment.organizationId,
                id: payment.id,
                contestId: payment.contestId,
                participantId: payment.participantId,
                amount: payment.amount,
                status: payment.status,
                razorpayPaymentId: payment.razorpayPaymentId,
                razorpayStatus: payment.razorpayStatus,
                failureReason: payment.failureReason,
                attempts: payment.attempts,
                paidAt: payment.paidAt,
                createdAt: payment.createdAt,
                webhookConfirmed: payment.webhookConfirmed,
            },
            contestId: payment.contestId,
            contactId: payment.contactId
        }
    }

    async getPaymentsByContest(params: {
        organizationId: string;
        contestId: string;
        limit: number;
        cursor?: string;
        status?: PaymentStatus | undefined;
    }): Promise<PaymentListResult> {

        const contest = await this.contestService.getContest(params.contestId, params.organizationId);
        if (!contest) throw new NotFoundError("contest not found");

        if (contest.organizationId !== params.organizationId) {
            throw new ForbiddenError("UnAuthorized");
        }

        const limit = Math.min(params.limit ?? 50, 100);
        const payments = await this.paymentRepo.findByEventIdPaginated({
            organizationId: params.organizationId,
            contestId: params.contestId,
            limit,
            ...(params.cursor && { cursor: params.cursor }),
            ...(params.status && { status: params.status })
        });

        return payments;
    }


    /**
     * Periodic safety net (see docs/payout-flow-audit.md §4.1) for the one failure mode
     * nothing else self-heals: a payment marked SUCCESS whose transfer job never got
     * created at all — e.g. Redis was briefly unreachable at the exact moment
     * handleWebhook tried to enqueue it. There's no PaymentRouteTransfer row in that
     * case, so PayoutService's own stuck-transfer resumption (see 3.1's fix) has nothing
     * to find. This sweep also re-enqueues stuck PENDING transfers that do have a row
     * but whose original job is gone (e.g. it already ran to "completion" from BullMQ's
     * point of view even though the business-level transfer never finished) — those will
     * resume correctly once re-invoked, per PayoutService.createRouteTransferForPayment.
     *
     * Both re-enqueues go through the same queue and worker as the normal webhook path —
     * this is not a separate code path for "doing the transfer", only for "noticing it
     * needs to happen again".
     */
    async reconcileStuckTransfers(): Promise<{ missingCount: number; stuckCount: number }> {
        const gracePeriodMs = config.payout.reconciliationGracePeriodMs;

        const missingPayments = await this.paymentRepo.findSuccessPaymentsMissingTransfer(gracePeriodMs);
        for (const payment of missingPayments) {
            if (!payment.razorpayPaymentId) continue; // defensive — query already filters this
            try {
                // This sweep runs recurringly — if a prior sweep's attempt for this
                // payment already failed, its job hash is still retained under this
                // same jobId (removeOnFail keeps the last N), and add() would silently
                // no-op instead of re-enqueuing. Same class of bug as the stuck-transfer
                // loop below already documents — evict any stale job first.
                await routeTransferQueue.remove(`route-transfer-${payment.id}`);
                await routeTransferQueue.add(
                    "create-route-transfer",
                    {
                        paymentId: payment.id,
                        organizationId: payment.organizationId,
                        amount: payment.amount,
                        razorpayPaymentId: payment.razorpayPaymentId,
                        currency: payment.currency,
                    },
                    { jobId: `route-transfer-${payment.id}` } // no extra delay — already well past the safety window
                );
                logger.warn("[reconciliation] Re-enqueued a SUCCESS payment with no transfer record at all", {
                    paymentId: payment.id,
                    organizationId: payment.organizationId,
                    ageMinutes: Math.round((Date.now() - payment.createdAt.getTime()) / 60000),
                });
            } catch (err) {
                logger.error("[reconciliation] Failed to re-enqueue a missing transfer — will retry next sweep", {
                    paymentId: payment.id,
                    err: (err as Error).message,
                });
            }
        }

        let stuckCount = 0;
        if (this.payoutService) {
            const stuckTransfers = await this.payoutService.findStuckPendingTransfers(gracePeriodMs);
            stuckCount = stuckTransfers.length;
            for (const transfer of stuckTransfers) {
                try {
                    // Deliberately NOT reusing `route-transfer-${paymentId}` as the jobId here:
                    // that job may already be sitting in BullMQ's "completed" or "failed" set
                    // (retained per removeOnComplete/removeOnFail), and BullMQ's jobId dedup
                    // would silently no-op the add() rather than create a fresh attempt.
                    await routeTransferQueue.add(
                        "create-route-transfer",
                        {
                            paymentId: transfer.paymentId,
                            organizationId: transfer.organizationId,
                            amount: transfer.grossAmount,
                            razorpayPaymentId: transfer.razorpayPaymentId,
                            currency: transfer.currency,
                        },
                        { jobId: `route-transfer-reconcile-${transfer.id}-${Date.now()}` }
                    );
                    logger.warn("[reconciliation] Re-enqueued a stuck PENDING transfer", {
                        paymentId: transfer.paymentId,
                        transferId: transfer.id,
                        ageMinutes: Math.round((Date.now() - transfer.createdAt.getTime()) / 60000),
                    });
                } catch (err) {
                    logger.error("[reconciliation] Failed to re-enqueue a stuck transfer — will retry next sweep", {
                        transferId: transfer.id,
                        err: (err as Error).message,
                    });
                }
            }
        }

        if (missingPayments.length > 0 || stuckCount > 0) {
            logger.warn("[reconciliation] Sweep complete", { missingCount: missingPayments.length, stuckCount });
        } else {
            logger.info("[reconciliation] Sweep complete — nothing to reconcile");
        }

        return { missingCount: missingPayments.length, stuckCount };
    }

    /** Registers the recurring BullMQ job that drives reconcileStuckTransfers on a schedule. */
    async ensureReconciliationRecurringJob(): Promise<void> {
        const jobId = "periodic-payout-reconciliation";
        const intervalMs = config.payout.reconciliationIntervalMinutes * 60 * 1000;

        const repeatables = await routeTransferQueue.getRepeatableJobs();
        const existing = repeatables.find((repeatable) => repeatable.id === jobId);
        if (existing) {
            await routeTransferQueue.removeRepeatableByKey(existing.key);
        }

        // This queue's generic type is RouteTransferJobPayload (per-payment transfer jobs);
        // the recurring housekeeping job carries no payload, hence the cast. The worker
        // dispatches on job.name before touching job.data, so this never gets read as a
        // RouteTransferJobPayload.
        await routeTransferQueue.add(
            "reconcile-transfers",
            {} as unknown as RouteTransferJobPayload,
            {
                jobId,
                repeat: { every: intervalMs },
                removeOnComplete: true,
                removeOnFail: true,
            }
        );

        logger.info(`[payment-service] Recurring payout reconciliation scheduled every ${config.payout.reconciliationIntervalMinutes} minutes`);
    }

    /**
     * Closes out abandoned payments — see payment.repository.ts:closeAbandoned.
     * Called on a schedule by payment-cleanup.worker.ts, not from any user-facing
     * path. Never blocks or interferes with an active resume-or-fresh attempt:
     * that flow reads/refreshes based on config.payment.orderReuseWindowMs (10 min
     * default), this sweep only touches rows stale well beyond that, by
     * config.payment.abandonedCloseAfterMs (24h default).
     */
    async closeAbandonedPayments(): Promise<{ closedCount: number }> {
        const closedCount = await this.paymentRepo.closeAbandoned(config.payment.abandonedCloseAfterMs);
        if (closedCount > 0) {
            logger.info(`[payment-cleanup] Closed ${closedCount} abandoned payment(s) to FAILED`);
        }
        return { closedCount };
    }

    /** Registers the recurring BullMQ job that drives closeAbandonedPayments on a schedule. */
    async ensurePaymentCleanupRecurringJob(): Promise<void> {
        const jobId = "periodic-payment-cleanup";
        const intervalMs = config.payment.abandonedSweepIntervalMs;

        const repeatables = await paymentCleanupQueue.getRepeatableJobs();
        const existing = repeatables.find((repeatable) => repeatable.id === jobId);
        if (existing) {
            await paymentCleanupQueue.removeRepeatableByKey(existing.key);
        }

        await paymentCleanupQueue.add(
            "close-abandoned-payments",
            {},
            {
                jobId,
                repeat: { every: intervalMs },
                removeOnComplete: true,
                removeOnFail: true,
            }
        );

        logger.info(`[payment-service] Recurring payment cleanup sweep scheduled every ${intervalMs / 60000} minutes`);
    }

    async getAllPayments(params: {
        organizationId: string;
        contestId?: string,
        contactId?: string,
        razorpayPaymentId?: string,
        limit: number,
        cursor?: string;
        status?: PaymentStatus | undefined
    }): Promise<PaymentListResult> {

        const limit = Math.min(params.limit ?? 50, 100);

        const payments = await this.paymentRepo.allPayments({
            organizationId: params.organizationId,
            ...(params.contestId && { contestId: params.contestId }),
            ...(params.contactId && { contactId: params.contactId }),
            ...(params.razorpayPaymentId && { razorpayPaymentId: params.razorpayPaymentId }),
            limit,
            ...(params.cursor && { cursor: params.cursor }),
            ...(params.status && { status: params.status })
        })
        return payments;
    }
}