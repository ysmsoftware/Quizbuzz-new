import { Payment, PaymentStatus } from "@prisma/client";
import { IPaymentRepository } from "./payment.repository";
import { RazorpayProvider } from '../../providers/razorpay.provider';
import { ContestService } from "../contest/contest.service";
import { ParticipantService } from "../participant/participant.service";
import { MessagingService } from "../messaging/messaging.service";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../error/http-errors";
import { MessageTemplate } from "../../types/message-template.enum";
import logger from "../../config/logger";


import { PaymentListResult, PaymentDetailResult } from "./payment.types";
import { PayoutService } from "../payout/payout.service";


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

        if (!contest.paymentEnabled) {
            throw new BadRequestError("This contest is not payable");
        }


        const config = contest.paymentConfig;
        if (!config || !config.amount) {
            throw new BadRequestError("Invalid payment configuration for this contest");
        }

        const amount = config.amount * 100 // paise
        const currency = (config.currency || 'INR').toUpperCase();

        const existingOrder = await this.paymentRepo.findByParticipantId(params.participantId);

        if (existingOrder?.status === "SUCCESS") {
            throw new BadRequestError("Payment already completed");
        }

        if (existingOrder && existingOrder?.status !== "FAILED" && existingOrder.razorpayOrderId) {
            return {
                orderId: existingOrder.razorpayOrderId,
                amount: existingOrder.amount,
                currency: existingOrder.currency,
                keyId: this.razorpay.getPublicKey(),
                paymentId: existingOrder.id
            }
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

                // Trigger Razorpay Route payout transfer
                if (this.payoutService) {
                    this.payoutService.createRouteTransferForPayment({
                        id: payment.id,
                        organizationId: payment.organizationId,
                        amount: payment.amount,
                        razorpayPaymentId: paymentEntity.id,
                        currency: payment.currency,
                    }).catch((err) => {
                        logger.error(`[payment] Failed to process route transfer: ${(err as Error).message}`, { paymentId: payment.id });
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