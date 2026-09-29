import { Payment, PaymentOrder, PaymentStatus } from "@prisma/client";
import { prisma } from "../../config/db";


export interface IPaymentRepository {
    create(params: {
        organizationId: string;
        contestId: string;
        participantId: string;
        contactId: string;
        amount: number;
        currency: string;
        razorpayOrderId: string;
    }): Promise<Payment>;

    findByParticipantId(participantId: string): Promise<Payment | null>;
    findById(id: string): Promise<Payment | null>;
    findByRazorpayOrderId(orderId: string): Promise<Payment | null>;
    findByRazorpayPaymentId(orderId: string): Promise<Payment | null>;

    markPending(orderId: string): Promise<Payment>;
    markSuccess(data: { paymentId: string; razorpayOrderId: string; razorpayPaymentId: string; paidAt: Date; metadata?: any }): Promise<Payment>;
    markFailed(razorpayOrderId: string, reason?: string): Promise<void>;
    reopen(paymentId: string): Promise<void>;
    markCancelled(paymentId: string): Promise<Payment>;
    closeAbandoned(olderThanMs: number): Promise<number>;


    findByEventIdPaginated(params: {
        organizationId: string;
        contestId: string;
        limit: number;
        cursor?: string;
        status?: PaymentStatus;
    }): Promise<{ items: Payment[]; nextCursor: string | null }>;

    allPayments(params: {
        organizationId: string;
        contestId?: string,
        contactId?: string,
        razorpayPaymentId?: string,
        limit: number,
        cursor?: string;
        status?: PaymentStatus;
    }): Promise<{ items: Payment[]; nextCursor: string | null }>;

    updateForRetry(data: { participantId: string; razorpayOrderId: string; }): Promise<Payment>;

    // ── Order history (payment_orders) ──
    findOrder(razorpayOrderId: string): Promise<(PaymentOrder & { payment: Payment }) | null>;
    listOrders(paymentId: string): Promise<PaymentOrder[]>;
    recordOrder(data: { paymentId: string; razorpayOrderId: string; amount: number; status?: PaymentStatus }): Promise<PaymentOrder>;
    updateOrder(razorpayOrderId: string, data: Partial<Pick<PaymentOrder, "status" | "razorpayPaymentId" | "method" | "failureReason" | "errorCode" | "errorReason">>): Promise<void>;
    /** Non-SUCCESS payments touched since `sinceMs` ago — reconciliation sweep candidates. */
    findUnsettledSince(sinceMs: number, limit?: number): Promise<Payment[]>;

    /**
     * Reconciliation query: SUCCESS payments with no PaymentRouteTransfer row at all,
     * older than the grace period. This is the "the enqueue itself never happened"
     * failure mode — there's no transfer row to inspect, so this is the only way to
     * find these.
     */
    findSuccessPaymentsMissingTransfer(olderThanMs: number, limit?: number): Promise<Payment[]>;
}


export class PaymentRepository implements IPaymentRepository {


    async create(params: {
        organizationId: string;
        contestId: string;
        participantId: string;
        contactId: string;
        amount: number;
        currency: string;
        razorpayOrderId: string;
    }): Promise<Payment> {
        return await prisma.payment.create({
            data: {
                organizationId: params.organizationId,
                contestId: params.contestId,
                participantId: params.participantId,
                contactId: params.contactId,
                amount: params.amount,
                currency: params.currency,
                razorpayOrderId: params.razorpayOrderId,
                status: PaymentStatus.CREATED,
                orders: { create: { razorpayOrderId: params.razorpayOrderId, amount: params.amount } },
            }
        })
    }

    async findByParticipantId(participantId: string): Promise<Payment | null> {
        return await prisma.payment.findUnique({
            where: { participantId }
        });
    }

    async findById(id: string): Promise<Payment | null> {
        return await prisma.payment.findUnique({
            where: { id }
        });
    }

    async findByRazorpayOrderId(orderId: string): Promise<Payment | null> {
        return await prisma.payment.findUnique({
            where: { razorpayOrderId: orderId }
        });
    }

    async findByRazorpayPaymentId(orderId: string): Promise<Payment | null> {
        return await prisma.payment.findUnique({
            where: { razorpayPaymentId: orderId }
        });
    }

    // FE verify step
    async markPending(orderId: string): Promise<Payment> {
        return await prisma.payment.update({
            where: { razorpayOrderId: orderId, status: PaymentStatus.CREATED },
            data: { status: PaymentStatus.PENDING }
        });
    }

    // Capture success — keyed by our payment id, NOT the order id: the capture may
    // land on an older order than the one currently on the row (a retry replaced
    // it), and the captured order must win. Guarded on status != SUCCESS so two
    // concurrent deliveries can't both run the side effects: Prisma throws P2025
    // when the WHERE matches nothing — callers treat that as "someone else won".
    async markSuccess(data: { paymentId: string; razorpayOrderId: string; razorpayPaymentId: string; paidAt: Date; metadata?: any }): Promise<Payment> {
        return await prisma.payment.update({
            where: { id: data.paymentId, status: { not: PaymentStatus.SUCCESS } },
            data: {
                razorpayOrderId: data.razorpayOrderId,
                razorpayPaymentId: data.razorpayPaymentId,
                paidAt: data.paidAt,
                status: PaymentStatus.SUCCESS,
                failureReason: null,
                webhookConfirmed: true,
                ...(data.metadata && { metadata: data.metadata })
            }
        });
    }

    // Only the row's current order, and never over SUCCESS. FAILED is included so
    // the latest attempt's reason replaces an older one. No-op if nothing matches.
    async markFailed(razorpayOrderId: string, reason?: string): Promise<void> {
        await prisma.payment.updateMany({
            where: {
                razorpayOrderId,
                status: {
                    in: [PaymentStatus.CREATED, PaymentStatus.PENDING, PaymentStatus.FAILED]
                }
            },
            data: {
                status: PaymentStatus.FAILED,
                ...(reason && { failureReason: reason })
            }
        });
    }

    // The same order is being handed out again for a fresh attempt: clear the
    // previous attempt's failure so status polling doesn't report it as this one's.
    async reopen(paymentId: string): Promise<void> {
        await prisma.payment.updateMany({
            where: { id: paymentId, status: { in: [PaymentStatus.FAILED, PaymentStatus.CANCELLED] } },
            data: { status: PaymentStatus.CREATED, failureReason: null },
        });
    }

    async markCancelled(paymentId: string): Promise<Payment> {
        return await prisma.payment.update({
            where: { id: paymentId },
            data: { status: PaymentStatus.CANCELLED }
        });
    }

    /**
     * Bulk-closes abandoned payments: still PENDING/CREATED (never resolved by a
     * webhook, never picked back up via resume-or-fresh) with no activity in the
     * last `olderThanMs`. `updatedAt` is the right anchor, not `createdAt` — a
     * retry via updateForRetry() bumps `updatedAt`, so someone who came back
     * recently is correctly left alone even if their original attempt is old.
     * Single bulk update, no history kept — the row itself is never deleted.
     */
    async closeAbandoned(olderThanMs: number): Promise<number> {
        const cutoff = new Date(Date.now() - olderThanMs);
        const result = await prisma.payment.updateMany({
            where: {
                status: { in: [PaymentStatus.PENDING, PaymentStatus.CREATED] },
                updatedAt: { lt: cutoff },
            },
            data: {
                status: PaymentStatus.FAILED,
                failureReason: "Abandoned — no payment confirmation received within the cleanup window",
            },
        });
        return result.count;
    }


    async findByEventIdPaginated(params: {
        organizationId: string;
        contestId: string;
        limit: number;
        cursor?: string;
        status?: PaymentStatus;
    }): Promise<{ items: Payment[]; nextCursor: string | null }> {
        const items = await prisma.payment.findMany({
            where: {
                organizationId: params.organizationId,
                contestId: params.contestId,
                ...(params.status && { status: params.status })
            },
            orderBy: { createdAt: "desc" },
            take: params.limit + 1,
            ...(params.cursor && { cursor: { id: params.cursor } }),
            ...(params.cursor && { skip: 1 }),
        });

        let nextCursor: string | null = null;
        if (items.length > params.limit) {
            const nextItem = items.pop();
            nextCursor = nextItem!.id;
        }

        return { items, nextCursor };
    }


    // A new order for an existing payment: becomes the row's current order AND is
    // appended to payment_orders — the previous order stays in history so a late
    // capture on it can still be matched.
    async updateForRetry(data: {
        participantId: string;
        razorpayOrderId: string;
    }): Promise<Payment> {
        return prisma.$transaction(async (tx) => {
            const payment = await tx.payment.update({
                where: { participantId: data.participantId },
                data: {
                    razorpayOrderId: data.razorpayOrderId,
                    status: PaymentStatus.CREATED,
                    attempts: { increment: 1 },
                    failureReason: null
                }
            });
            await tx.paymentOrder.create({
                data: { paymentId: payment.id, razorpayOrderId: data.razorpayOrderId, amount: payment.amount },
            });
            return payment;
        });
    }

    async findOrder(razorpayOrderId: string) {
        return prisma.paymentOrder.findUnique({
            where: { razorpayOrderId },
            include: { payment: true },
        });
    }

    async listOrders(paymentId: string) {
        return prisma.paymentOrder.findMany({
            where: { paymentId },
            orderBy: { createdAt: "asc" },
        });
    }

    async recordOrder(data: { paymentId: string; razorpayOrderId: string; amount: number; status?: PaymentStatus }) {
        return prisma.paymentOrder.upsert({
            where: { razorpayOrderId: data.razorpayOrderId },
            create: { ...data },
            update: {},
        });
    }

    async updateOrder(razorpayOrderId: string, data: Partial<Pick<PaymentOrder, "status" | "razorpayPaymentId" | "method" | "failureReason" | "errorCode" | "errorReason">>) {
        // A SUCCESS order is final — a later failed attempt event must not downgrade it.
        await prisma.paymentOrder.updateMany({
            where: { razorpayOrderId, status: { not: PaymentStatus.SUCCESS } },
            data,
        });
    }

    async findUnsettledSince(sinceMs: number, limit = 200) {
        return prisma.payment.findMany({
            where: {
                status: { in: [PaymentStatus.CREATED, PaymentStatus.PENDING, PaymentStatus.FAILED] },
                razorpayOrderId: { not: null },
                isDeleted: false,
                updatedAt: { gte: new Date(Date.now() - sinceMs) },
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
        });
    }

    async findSuccessPaymentsMissingTransfer(olderThanMs: number, limit = 200): Promise<Payment[]> {
        const cutoff = new Date(Date.now() - olderThanMs);
        return prisma.payment.findMany({
            where: {
                status: PaymentStatus.SUCCESS,
                razorpayPaymentId: { not: null },
                createdAt: { lt: cutoff },
                routeTransfer: null,
            },
            orderBy: { createdAt: "asc" },
            take: limit,
        });
    }

    async allPayments(params: {
        organizationId: string;
        contestId?: string,
        contactId?: string,
        razorpayPaymentId?: string,
        limit: number,
        cursor?: string;
        status?: PaymentStatus;
    }): Promise<{ items: Payment[]; nextCursor: string | null }> {

        const items = await prisma.payment.findMany({
            where: {
                organizationId: params.organizationId,
                ...(params.contestId && { contestId: params.contestId }),
                ...(params.contactId && { contactId: params.contactId }),
                ...(params.razorpayPaymentId && { razorpayPaymentId: params.razorpayPaymentId }),
                ...(params.status && { status: params.status }),
            },
            orderBy: { createdAt: "desc" },
            take: params.limit + 1,
            ...(params.cursor && { cursor: { id: params.cursor } }),
            ...(params.cursor && { skip: 1 }),
        });

        let nextCursor: string | null = null;
        if (items.length > params.limit) {
            const nextItem = items.pop();
            nextCursor = nextItem!.id;
        }

        return { items, nextCursor }
    }


}