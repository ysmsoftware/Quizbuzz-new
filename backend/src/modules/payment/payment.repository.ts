import { Payment, PaymentStatus } from "@prisma/client";
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
    markSuccess(data: { razorpayOrderId: string; razorpayPaymentId: string; paidAt: Date; metadata?: any }): Promise<Payment>;
    markFailed(razorpayOrderId: string, reason?: string): Promise<Payment>;
    markCancelled(paymentId: string): Promise<Payment>;


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
                status: PaymentStatus.CREATED


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

    // webhook success
    async markSuccess(data: { razorpayOrderId: string; razorpayPaymentId: string; paidAt: Date; metadata?: any }): Promise<Payment> {
        return await prisma.payment.update({
            where: { razorpayOrderId: data.razorpayOrderId },
            data: {
                razorpayPaymentId: data.razorpayPaymentId,
                paidAt: data.paidAt,
                status: PaymentStatus.SUCCESS,
                webhookConfirmed: true,
                ...(data.metadata && { metadata: data.metadata })

            }
        });
    }

    async markFailed(razorpayOrderId: string, reason?: string): Promise<Payment> {
        return await prisma.payment.update({
            where: {
                razorpayOrderId,
                status: {
                    in: [PaymentStatus.CREATED, PaymentStatus.PENDING]
                }
            },
            data: {
                status: PaymentStatus.FAILED,
                ...(reason && { failureReason: reason })
            }
        });
    }

    async markCancelled(paymentId: string): Promise<Payment> {
        return await prisma.payment.update({
            where: { id: paymentId },
            data: { status: PaymentStatus.CANCELLED }
        });
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


    async updateForRetry(data: {
        participantId: string;
        razorpayOrderId: string;
    }): Promise<Payment> {
        return prisma.payment.update({
            where: { participantId: data.participantId },
            data: {
                razorpayOrderId: data.razorpayOrderId,
                status: PaymentStatus.CREATED,
                attempts: { increment: 1 },
                failureReason: null
            }
        })
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