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

export type CreateOrderResult =
    | { alreadyPaid?: false; orderId: string; amount: number; currency: string; keyId: string; paymentId: string }
    // The registration is already paid (possibly just discovered via Razorpay) — no checkout needed.
    | { alreadyPaid: true; paymentId: string };

export interface ParticipantPaymentDetails {
    payment: {
        id: string;
        status: PaymentStatus;
        amount: number; // paise
        currency: string;
        razorpayOrderId: string | null;
        razorpayPaymentId: string | null;
        failureReason: string | null;
        attempts: number;
        webhookConfirmed: boolean;
        paidAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    } | null;
    orders: {
        razorpayOrderId: string;
        status: PaymentStatus;
        razorpayPaymentId: string | null;
        method: string | null;
        failureReason: string | null;
        errorCode: string | null;
        errorReason: string | null;
        isCurrent: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[];
    razorpayReceipts: { original: string; retry: string };
}
