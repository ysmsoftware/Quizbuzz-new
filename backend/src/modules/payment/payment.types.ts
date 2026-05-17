import { Payment, PaymentStatus } from "@prisma/client";

export type PaymentListResult = {
    items: Payment[];
    nextCursor: string | null;
};

export type PaymentDetailResult = {
    payment: {
        id: string;
        organizationId: string;
        contestId: string;
        participantId: string; // Fixed typo parpticipantId -> participantId
        amount: number;
        status: PaymentStatus;
        razorpayPaymentId: string | null;
        razorpayStatus: string | null;
        failureReason: string | null;
        attempts: number;
        paidAt: Date | null;
        createdAt: Date;
        webhookConfirmed: boolean;
    };
    contestId: string;
    contactId: string | null;
};

export interface CreateOrderInput {
    contestId: string;
    participantId: string;
}

export interface VerifyPaymentInput {
    razorpayPaymentId: string;
    razorpayOrderId: string;
    razorpaySignature: string;
}
