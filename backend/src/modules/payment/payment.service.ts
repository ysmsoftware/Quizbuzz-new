import { Payment, PaymentStatus, Prisma } from "@prisma/client";
import { IPaymentRepository } from "./payment.repository";
import { RazorpayProvider, RazorpayPaymentEntity } from '../../providers/razorpay.provider';
import { ContestService } from "../contest/contest.service";
import { ParticipantService } from "../participant/participant.service";
import { MessagingService } from "../messaging/messaging.service";
import { BadRequestError, ForbiddenError, NotFoundError, FeatureUnavailableError } from "../../error/http-errors";
import { isFeatureEnabled } from "../../common/feature-flags";
import { MessageTemplate } from "../../types/message-template.enum";
import logger from "../../config/logger";


import { PaymentListResult, PaymentDetailResult, CreateOrderResult, ParticipantPaymentDetails, RazorpayVerificationCheck, RazorpayVerificationPreview } from "./payment.types";
import { PayoutService } from "../payout/payout.service";
import { OrganizationRepository } from "../organization/organization.repository";
import { routeTransferQueue, RouteTransferJobPayload, paymentCleanupQueue } from "../../queues";
import { config } from "../../config";
import { logAudit } from "../../common/audit-log";
import { formatDateHuman, formatTimeHuman } from "../../utils/timezone";

// Status polling asks Razorpay at most this often per payment.
const RECONCILE_THROTTLE_MS = 10_000;
// Only the newest few orders of a payment are checked against Razorpay.
const RECONCILE_MAX_ORDERS = 5;
// The periodic sweep re-checks unpaid/failed payments touched within this window.
const RECONCILE_SWEEP_LOOKBACK_MS = 48 * 60 * 60 * 1000;

// Receipts stamped on every Razorpay order we create (≤ 40 chars). Searching
// them in Razorpay → Orders lists every order ever made for a participant.
// ops-next's payment-details page derives the same strings — keep in sync.
export function razorpayReceipts(participantId: string): { original: string; retry: string } {
    const compact = participantId.replace(/-/g, "");
    return { original: `rcpt_${compact.slice(0, 30)}`, retry: `rcpt_r_${compact.slice(0, 27)}` };
}

// Every order we create carries notes.participantId; Razorpay copies order
// notes onto its payments. (Razorpay sends [] for empty notes.)
function notesParticipantId(notes: RazorpayPaymentEntity["notes"]): string | undefined {
    return notes && !Array.isArray(notes) ? notes.participantId : undefined;
}

export class PaymentService {

    constructor(
        private paymentRepo: IPaymentRepository,
        private razorpay: RazorpayProvider,
        private contestService: ContestService,
        private participantService: ParticipantService,
        private messagingService: MessagingService,
        private payoutService?: PayoutService,
        private organizationRepo?: OrganizationRepository,
    ) { }


    async createOrder(params: { contestId: string, participantId: string }): Promise<CreateOrderResult> {
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

        if (existingOrder?.status === PaymentStatus.SUCCESS) {
            // Not an error for the payer — the frontend treats this as success.
            return { alreadyPaid: true, paymentId: existingOrder.id };
        }

        if (existingOrder && existingOrder.razorpayOrderId) {
            // Ask Razorpay before handing out (or creating) another order: a capture
            // whose webhook we dropped or haven't received yet means they've paid —
            // creating a second order here is exactly how people got charged and
            // still shown "failed". Razorpay being down must not block paying.
            try {
                if (await this.reconcileWithRazorpay(existingOrder)) {
                    return { alreadyPaid: true, paymentId: existingOrder.id };
                }
            } catch (err) {
                logger.warn("[payment] Pre-order Razorpay check failed — continuing", {
                    paymentId: existingOrder.id,
                    err: (err as Error).message,
                });
            }

            // Reuse window is measured from when the *current* order was created —
            // not the payment row, which is older after any retry.
            const orders = await this.paymentRepo.listOrders(existingOrder.id);
            const currentOrder = orders.find((o) => o.razorpayOrderId === existingOrder.razorpayOrderId);
            const ageMs = Date.now() - (currentOrder?.createdAt ?? existingOrder.createdAt).getTime();

            // Same order for every click inside the window, even after a failed
            // attempt — Razorpay accepts new attempts on an order until it is paid,
            // and one order per registration means a second debit is impossible.
            if (ageMs < config.payment.orderReuseWindowMs && existingOrder.amount === amount) {
                await this.paymentRepo.reopen(existingOrder.id);
                return {
                    orderId: existingOrder.razorpayOrderId,
                    amount: existingOrder.amount,
                    currency: existingOrder.currency,
                    keyId: this.razorpay.getPublicKey(),
                    paymentId: existingOrder.id
                };
            }

            // Window expired (or the fee changed): new order. updateForRetry keeps the
            // previous order in payment_orders — it's never overwritten away.
            const order = await this.razorpay.createOrder({
                amount,
                currency,
                receipt: razorpayReceipts(params.participantId).retry,
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

        const order = await this.razorpay.createOrder({
            amount,
            currency,
            receipt: razorpayReceipts(params.participantId).original,
            notes: {
                participantId: params.participantId,
                contestId: contest.id,
                contestName: contest.title
            }
        });

        // Store payment in DB (also records the order in payment_orders)
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

    // Called by the checkout success handler. A valid signature means Razorpay
    // accepted a payment on this order — confirm it against Razorpay right away
    // instead of waiting for the webhook.
    async verifyPayment(params: { razorpayPaymentId: string, razorpayOrderId: string, razorpaySignature: string }): Promise<void> {
        const isVerified = this.razorpay.verifyPaymentSignature(params);
        if (!isVerified) {
            throw new BadRequestError("Payment signature does not match");
        }

        const order = await this.paymentRepo.findOrder(params.razorpayOrderId);
        const payment = order?.payment ?? await this.paymentRepo.findByRazorpayOrderId(params.razorpayOrderId);
        if (!payment) {
            throw new NotFoundError("Payment not found");
        }
        if (payment.status === PaymentStatus.SUCCESS) {
            return;
        }

        try {
            await this.reconcileWithRazorpay(payment);
        } catch (err) {
            // The webhook / status polling will still settle it.
            logger.warn("[payment] Razorpay check after checkout failed", {
                paymentId: payment.id,
                err: (err as Error).message,
            });
        }
    }


    /**
     * Status polling endpoint, hit every few seconds by the frontend after checkout
     * (all devices — including mobile UPI redirects where the JS handler never runs).
     * The webhook normally settles the row; when it hasn't (still unpaid, or a UPI
     * "failed" that Razorpay later flips to captured), we ask Razorpay directly,
     * throttled per participant.
     */
    async checkPaymentStatus(participantId: string): Promise<{
        status: PaymentStatus;
        webhookConfirmed: boolean;
        failureReason: string | null;
    }> {
        let payment = await this.paymentRepo.findByParticipantId(participantId);
        if (!payment) {
            throw new NotFoundError("Payment record not found for this participant");
        }

        if (payment.status !== PaymentStatus.SUCCESS && payment.razorpayOrderId && this.shouldReconcileNow(payment.id)) {
            try {
                if (await this.reconcileWithRazorpay(payment)) {
                    payment = (await this.paymentRepo.findByParticipantId(participantId)) ?? payment;
                }
            } catch (err) {
                logger.warn("[payment] Status-poll Razorpay check failed", { paymentId: payment.id, err: (err as Error).message });
            }
        }

        return {
            status: payment.status,
            webhookConfirmed: payment.webhookConfirmed,
            failureReason: payment.failureReason,
        };
    }

    // ponytail: per-process throttle — with N API instances Razorpay sees up to N
    // lookups per window per participant; move to Redis SET NX EX if that matters.
    private lastReconcileAt = new Map<string, number>();
    private shouldReconcileNow(paymentId: string): boolean {
        const now = Date.now();
        const last = this.lastReconcileAt.get(paymentId) ?? 0;
        if (now - last < RECONCILE_THROTTLE_MS) return false;
        this.lastReconcileAt.set(paymentId, now);
        if (this.lastReconcileAt.size > 10_000) this.lastReconcileAt.clear();
        return true;
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

        const paymentEntity = parsed.payload?.payment?.entity as RazorpayPaymentEntity | undefined;
        if (!paymentEntity?.order_id) {
            return;
        }

        const payment = await this.resolvePayment(paymentEntity);
        if (!payment) {
            logger.warn("Webhook received for unknown order:", { razorpayOrderId: paymentEntity.order_id, razorpayPaymentId: paymentEntity.id });
            return; // order not found in our sys
        }

        if (payment.amount !== paymentEntity.amount) {
            logger.error("Amount mismatch in webhook", {
                dbAmount: payment.amount,
                razorpayAmount: paymentEntity.amount,
                orderId: paymentEntity.order_id
            });
            return;
        }

        switch (event) {
            case "payment.captured":
                await this.applyCapture(payment, paymentEntity, "webhook");
                break;

            case "payment.failed":
                await this.applyFailedAttempt(payment, paymentEntity);
                break;

            default:
                break;
        }
    }

    /**
     * Finds our Payment for a Razorpay payment: by order history first, then the
     * row's current order (pre-history rows), then the participantId we stamp on
     * every order's notes — which re-links captures on orders we no longer track
     * and records that order in history.
     */
    private async resolvePayment(entity: RazorpayPaymentEntity): Promise<Payment | null> {
        const order = await this.paymentRepo.findOrder(entity.order_id);
        if (order) return order.payment;

        const byCurrentOrder = await this.paymentRepo.findByRazorpayOrderId(entity.order_id);
        const participantId = notesParticipantId(entity.notes);
        const payment = byCurrentOrder ?? (participantId ? await this.paymentRepo.findByParticipantId(participantId) : null);
        if (!payment) return null;

        await this.paymentRepo.recordOrder({ paymentId: payment.id, razorpayOrderId: entity.order_id, amount: entity.amount });
        if (!byCurrentOrder) {
            logger.warn("[payment] Re-linked a Razorpay order missing from history via notes.participantId", {
                paymentId: payment.id,
                razorpayOrderId: entity.order_id,
            });
        }
        return payment;
    }

    /**
     * A captured Razorpay payment always wins: whatever order it landed on and
     * whatever our row says (FAILED included — UPI routinely reports failed, then
     * captured seconds later). Idempotent. Returns true if this call flipped the
     * payment to SUCCESS (and ran confirmation side effects).
     */
    private async applyCapture(payment: Payment, entity: RazorpayPaymentEntity, source: "webhook" | "reconcile" | "manual"): Promise<boolean> {
        await this.paymentRepo.updateOrder(entity.order_id, {
            status: PaymentStatus.SUCCESS,
            razorpayPaymentId: entity.id,
            method: entity.method ?? null,
            failureReason: null,
            errorCode: null,
            errorReason: null,
        });

        if (payment.status === PaymentStatus.SUCCESS) {
            if (payment.razorpayPaymentId && payment.razorpayPaymentId !== entity.id) {
                // Paid twice (two orders, both captured). Keep it visible for a refund.
                logger.error("[payment] Duplicate capture for an already-paid registration — refund needed", {
                    paymentId: payment.id,
                    keptRazorpayPaymentId: payment.razorpayPaymentId,
                    duplicateRazorpayPaymentId: entity.id,
                    razorpayOrderId: entity.order_id,
                });
                logAudit({
                    action: "payment.duplicate_captured",
                    targetType: "PAYMENT",
                    targetId: payment.id,
                    targetLabel: `₹${(entity.amount / 100).toFixed(2)} ${entity.currency}`,
                    organizationId: payment.organizationId,
                    metadata: { razorpayOrderId: entity.order_id, razorpayPaymentId: entity.id, keptRazorpayPaymentId: payment.razorpayPaymentId },
                    ...(source !== "manual" && { actorType: source === "webhook" ? "WEBHOOK" : "SYSTEM", actorLabel: source === "webhook" ? "Razorpay webhook" : "Razorpay reconciliation" }),
                });
            }
            return false;
        }

        // markSuccess's WHERE guards on status != SUCCESS: if a concurrent delivery
        // already won (P2025), it already ran confirmation, email and receipts.
        try {
            await this.paymentRepo.markSuccess({
                paymentId: payment.id,
                razorpayOrderId: entity.order_id,
                razorpayPaymentId: entity.id,
                paidAt: new Date(entity.created_at * 1000),
                metadata: {
                    event: "payment.captured",
                    source,
                    paymentId: entity.id,
                    orderId: entity.order_id,
                    method: entity.method,
                    email: entity.email,
                    contact: entity.contact
                }
            });
        } catch (err: any) {
            const lostRace =
                err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
            if (lostRace) {
                logger.info("[payment] Concurrent delivery already marked this payment SUCCESS — skipping duplicate processing", {
                    razorpayOrderId: entity.order_id,
                    paymentId: payment.id,
                });
                return false;
            }
            throw err;
        }

        logAudit({
            action: "payment.captured",
            targetType: "PAYMENT",
            targetId: payment.id,
            targetLabel: `₹${(payment.amount / 100).toFixed(2)} ${payment.currency}`,
            organizationId: payment.organizationId,
            metadata: {
                razorpayOrderId: entity.order_id,
                razorpayPaymentId: entity.id,
                method: entity.method,
                source,
                previousStatus: payment.status,
            },
            // Manual verification inherits the admin from the request's audit context.
            ...(source !== "manual" && { actorType: source === "webhook" ? "WEBHOOK" : "SYSTEM", actorLabel: source === "webhook" ? "Razorpay webhook" : "Razorpay reconciliation" }),
        });

        if (source !== "webhook") {
            logger.warn(`[payment] Payment ${payment.id} settled to SUCCESS via ${source} (was ${payment.status}) — webhook alone did not settle it`);
        }

        // Confirm the participant's seat: PENDING_PAYMENT → REGISTERED
        // This is the source-of-truth gate for paid contests.
        if (payment.participantId) {
            await this.participantService.confirmPaymentRegistration(payment.participantId);
            logger.info(`[payment] Confirmed registration for participant ${payment.participantId} after payment captured`);
        }

        // Send payment confirmation + registration-successful emails (the latter
        // mirrors the free-contest confirmation contest.service.ts sends on
        // registration — paid contests only get it once payment is captured).
        if (payment.participantId) {
            Promise.all([
                this.participantService.getParticipantById(
                    payment.contestId,
                    payment.participantId,
                    payment.organizationId
                ),
                this.organizationRepo?.findTimezone(payment.organizationId) ?? Promise.resolve(null),
            ]).then(([participant, timezone]) => {
                const fullName = participant.contact.lastName
                    ? `${participant.contact.firstName} ${participant.contact.lastName}`
                    : participant.contact.firstName;
                const recipient = entity.email || participant.contact.email || '';

                return Promise.all([
                    this.messagingService.enqueueMessage(payment.organizationId, {
                        participantId: payment.participantId,
                        contestId: payment.contestId ?? undefined,
                        channel: "EMAIL",
                        template: MessageTemplate.PAYMENT_CONFIRMATION_MESSAGE,
                        recipient,
                        params: {
                            name: fullName,
                            amount: `₹${(payment.amount / 100).toFixed(2)}`,
                            eventName: participant.contest.title,
                        },
                    }),
                    this.messagingService.enqueueMessage(payment.organizationId, {
                        participantId: payment.participantId,
                        contestId: payment.contestId ?? undefined,
                        channel: "EMAIL",
                        template: MessageTemplate.REGISTRATION_SUCCESSFUL,
                        recipient,
                        params: {
                            name: fullName,
                            eventName: participant.contest.title,
                            date: participant.contest.startTime ? formatDateHuman(participant.contest.startTime, timezone) : 'TBD',
                            time: participant.contest.startTime ? formatTimeHuman(participant.contest.startTime, timezone) : 'TBD',
                            link: `${config.app.frontendUrl}/quiz/${participant.contest.slug}/join`,
                            joinCode: participant.contest.joinCode || 'N/A',
                        },
                    }),
                ]);
            }).catch((err) => {
                logger.error(`[payment] Failed to enqueue post-payment messages: ${(err as Error).message}`);
            });
        }

        return true;
    }

    /**
     * A failed attempt is recorded on its order. It only flips the payment row to
     * FAILED when it's on the row's *current* order — a failure on an older order
     * says nothing about the live one. Never downgrades SUCCESS.
     */
    private async applyFailedAttempt(payment: Payment, entity: RazorpayPaymentEntity): Promise<void> {
        const reason = entity.error_description || "Payment failed";
        await this.paymentRepo.updateOrder(entity.order_id, {
            status: PaymentStatus.FAILED,
            razorpayPaymentId: entity.id,
            method: entity.method ?? null,
            failureReason: reason,
            errorCode: entity.error_code ?? null,
            errorReason: entity.error_reason ?? null,
        });

        if (payment.status !== PaymentStatus.SUCCESS && payment.razorpayOrderId === entity.order_id) {
            await this.paymentRepo.markFailed(entity.order_id, reason);
        }
    }

    /**
     * Asks Razorpay for every attempt on every order of this payment (newest few
     * orders). A captured attempt settles the payment exactly like the webhook
     * would. Returns true if the payment is (now) SUCCESS because of this check.
     */
    async reconcileWithRazorpay(payment: Payment): Promise<boolean> {
        const orders = await this.paymentRepo.listOrders(payment.id);
        const orderIds = orders.length
            ? orders.map((o) => o.razorpayOrderId)
            : [payment.razorpayOrderId].filter((id): id is string => !!id);

        for (const orderId of orderIds.slice(-RECONCILE_MAX_ORDERS).reverse()) {
            const attempts = await this.razorpay.fetchOrderPayments(orderId);
            const captured = attempts.find((a) => a.status === "captured" && a.amount === payment.amount);
            if (captured) {
                if (!orders.some((o) => o.razorpayOrderId === orderId)) {
                    await this.paymentRepo.recordOrder({ paymentId: payment.id, razorpayOrderId: orderId, amount: captured.amount });
                }
                await this.applyCapture(payment, captured, "reconcile");
                return true;
            }

            // Keep the order's history current even when nothing was captured.
            const latest = [...attempts].sort((a, b) => b.created_at - a.created_at)[0];
            if (latest?.status === "failed") {
                await this.paymentRepo.updateOrder(orderId, {
                    status: PaymentStatus.FAILED,
                    razorpayPaymentId: latest.id,
                    method: latest.method ?? null,
                    failureReason: latest.error_description || "Payment failed",
                    errorCode: latest.error_code ?? null,
                    errorReason: latest.error_reason ?? null,
                });
            }
        }
        return false;
    }

    /**
     * Looks a Razorpay payment/order ID up on Razorpay and runs every check a
     * manual settlement needs. Read-only. Used by the admin preview (so they can
     * cross-check what Razorpay returned) and re-run in full by the confirm step —
     * the confirm never trusts the preview.
     */
    private async inspectRazorpayReference(params: {
        participantId: string;
        organizationId: string;
        reference: string;
    }): Promise<{ payment: Payment; entity: RazorpayPaymentEntity; checks: RazorpayVerificationCheck[] }> {
        const payment = await this.paymentRepo.findByParticipantId(params.participantId);
        if (!payment || payment.organizationId !== params.organizationId) {
            throw new NotFoundError("No payment record found for this participant");
        }

        const reference = params.reference.trim();
        let entity: RazorpayPaymentEntity | undefined;
        try {
            if (reference.startsWith("pay_")) {
                entity = await this.razorpay.fetchPayment(reference);
            } else if (reference.startsWith("order_")) {
                const attempts = await this.razorpay.fetchOrderPayments(reference);
                entity = attempts.find((a) => a.status === "captured") ?? attempts[0];
                if (!entity) throw new BadRequestError("Razorpay has no payment attempts on this order");
            } else {
                throw new BadRequestError("Enter a Razorpay payment ID (pay_…) or order ID (order_…)");
            }
        } catch (err) {
            if (err instanceof BadRequestError) throw err;
            logger.warn("[payment] Razorpay lookup failed during manual verification", { reference, err: (err as any)?.error ?? (err as Error)?.message });
            throw new BadRequestError("Razorpay could not find this ID on our account — check it and try again");
        }

        const expected = `${payment.currency} ${(payment.amount / 100).toFixed(2)}`;
        const got = `${entity.currency} ${(entity.amount / 100).toFixed(2)}`;

        // Must belong to this registration — otherwise any captured payment on the
        // account could be used to confirm someone else.
        const orders = await this.paymentRepo.listOrders(payment.id);
        let owned = orders.some((o) => o.razorpayOrderId === entity!.order_id)
            || notesParticipantId(entity.notes) === params.participantId;
        if (!owned) {
            const order = await this.razorpay.fetchOrder(entity.order_id);
            const receipts = razorpayReceipts(params.participantId);
            owned = notesParticipantId(order.notes) === params.participantId
                || order.receipt === receipts.original
                || order.receipt === receipts.retry;
        }

        const linkedPayment = await this.paymentRepo.findByRazorpayPaymentId(entity.id);
        const linkedOrder = await this.paymentRepo.findOrder(entity.order_id);
        const linkedElsewhere = (!!linkedPayment && linkedPayment.id !== payment.id) || (!!linkedOrder && linkedOrder.paymentId !== payment.id);

        const why = entity.error_description ? `: ${entity.error_description}` : "";
        const checks: RazorpayVerificationCheck[] = [
            {
                label: "Captured by Razorpay",
                ok: entity.status === "captured",
                detail: entity.status === "captured"
                    ? "Razorpay has received this money"
                    : `Razorpay reports this payment as "${entity.status}"${why}. Only captured payments can be accepted.`,
            },
            {
                label: "Amount matches",
                ok: entity.amount === payment.amount && entity.currency === payment.currency,
                detail: entity.amount === payment.amount && entity.currency === payment.currency
                    ? got
                    : `Amount mismatch: Razorpay captured ${got}, this registration expects ${expected}`,
            },
            {
                label: "Belongs to this registration",
                ok: owned,
                detail: owned ? "Order was created for this participant" : "This Razorpay payment belongs to a different registration",
            },
            {
                label: "Not used by another registration",
                ok: !linkedElsewhere,
                detail: linkedElsewhere ? "This Razorpay payment is already linked to another registration" : "Not linked anywhere else",
            },
            {
                label: "Registration still unpaid",
                ok: payment.status !== PaymentStatus.SUCCESS,
                detail: payment.status === PaymentStatus.SUCCESS ? "This registration is already marked as paid" : `Currently ${payment.status}`,
            },
        ];

        return { payment, entity, checks };
    }

    /** Admin step 1: what Razorpay has for this ID, and whether it can be accepted. No writes. */
    async previewRazorpayPaymentForParticipant(params: {
        participantId: string;
        organizationId: string;
        reference: string;
    }): Promise<RazorpayVerificationPreview> {
        const { entity, checks } = await this.inspectRazorpayReference(params);
        return {
            razorpay: {
                paymentId: entity.id,
                orderId: entity.order_id,
                status: entity.status,
                amount: entity.amount,
                currency: entity.currency,
                method: entity.method ?? null,
                vpa: entity.vpa ?? null,
                bankRrn: entity.acquirer_data?.rrn ?? null,
                email: entity.email ?? null,
                contact: entity.contact ?? null,
                createdAt: new Date(entity.created_at * 1000),
                errorDescription: entity.error_description ?? null,
            },
            checks,
            canConfirm: checks.every((c) => c.ok),
        };
    }

    /**
     * Admin step 2: settle the registration from a Razorpay payment exactly like the
     * webhook would (confirm seat + emails). Re-runs every check itself — only the
     * ID comes from the admin.
     */
    async verifyRazorpayPaymentForParticipant(params: {
        participantId: string;
        organizationId: string;
        reference: string;
    }): Promise<ParticipantPaymentDetails> {
        const { payment, entity, checks } = await this.inspectRazorpayReference(params);
        const failed = checks.find((c) => !c.ok);
        if (failed) {
            throw new BadRequestError(failed.detail);
        }
        const reference = params.reference.trim();

        await this.paymentRepo.recordOrder({ paymentId: payment.id, razorpayOrderId: entity.order_id, amount: entity.amount });
        await this.applyCapture(payment, entity, "manual");

        logAudit({
            action: "payment.manually_verified",
            targetType: "PAYMENT",
            targetId: payment.id,
            targetLabel: `₹${(payment.amount / 100).toFixed(2)} ${payment.currency}`,
            organizationId: payment.organizationId,
            metadata: { reference, razorpayOrderId: entity.order_id, razorpayPaymentId: entity.id, previousStatus: payment.status },
        });

        return this.getParticipantPaymentDetails(params.participantId, params.organizationId);
    }

    /** Everything we know about one participant's payment, incl. every order — for the registrations drawer. */
    async getParticipantPaymentDetails(participantId: string, organizationId: string): Promise<ParticipantPaymentDetails> {
        const payment = await this.paymentRepo.findByParticipantId(participantId);
        if (!payment || payment.organizationId !== organizationId) {
            return { payment: null, orders: [], razorpayReceipts: razorpayReceipts(participantId) };
        }
        const orders = await this.paymentRepo.listOrders(payment.id);
        return {
            payment: {
                id: payment.id,
                status: payment.status,
                amount: payment.amount,
                currency: payment.currency,
                razorpayOrderId: payment.razorpayOrderId,
                razorpayPaymentId: payment.razorpayPaymentId,
                failureReason: payment.failureReason,
                attempts: payment.attempts,
                webhookConfirmed: payment.webhookConfirmed,
                paidAt: payment.paidAt,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt,
            },
            orders: orders.map((o) => ({
                razorpayOrderId: o.razorpayOrderId,
                status: o.status,
                razorpayPaymentId: o.razorpayPaymentId,
                method: o.method,
                failureReason: o.failureReason,
                errorCode: o.errorCode,
                errorReason: o.errorReason,
                isCurrent: o.razorpayOrderId === payment.razorpayOrderId,
                createdAt: o.createdAt,
                updatedAt: o.updatedAt,
            })),
            razorpayReceipts: razorpayReceipts(participantId),
        };
    }

    /**
     * Periodic safety net: re-checks recently touched unpaid/failed payments
     * against Razorpay, for webhooks that never arrived or were mishandled.
     */
    async reconcileRecentPayments(): Promise<{ checked: number; settled: number }> {
        const candidates = await this.paymentRepo.findUnsettledSince(RECONCILE_SWEEP_LOOKBACK_MS);
        let settled = 0;
        for (const payment of candidates) {
            try {
                if (await this.reconcileWithRazorpay(payment)) settled++;
            } catch (err) {
                logger.warn("[payment-reconcile] Razorpay check failed — will retry next sweep", {
                    paymentId: payment.id,
                    err: (err as Error).message,
                });
            }
        }
        if (settled > 0) {
            logger.warn(`[payment-reconcile] Settled ${settled} payment(s) the webhook had not — investigate webhook delivery`);
        }
        return { checked: candidates.length, settled };
    }

    // Kept for API compatibility — same resume-or-fresh rules as createOrder.
    async retryPayment(participantId: string, contestId: string): Promise<CreateOrderResult> {
        return this.createOrder({ participantId, contestId });
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