
import { get, post, patch } from './apiClient';
import type { ApiResponse } from './apiClient';



export interface CreateOrderResult {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    paymentId: string;
}



export interface PaymentStatusResult {
    payment: {
        id: string
        contestId: string
        participantId: string
        amount: number
        status: "CREATED" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED"
        webhookConfirmed: boolean
        razorpayPaymentId: string | null
        paidAt: string | null
        failureReason: string | null
    }
    contestId: string
    contactId: string
}


export async function createOrder(contestId: string, contactId: string): Promise<ApiResponse<CreateOrderResult>> {
    return post<CreateOrderResult>("/payments/create-order", { contestId, contactId });
}


/**
 * POST /payments/verify
 * Public: Verify payment after Razorpay checkout
 */
export async function verifyPayment(
    body: {
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
        participantId: string;
    },
    idempotencyKey?: string
): Promise<ApiResponse> {
    return post('/payments/verify', body, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
    });
}

/**
 * POST /payments/retry
 * Public: Create a new order for failed payment
 */
export async function retryPayment(
    participantId: string,
    contestId: string,
    idempotencyKey?: string
): Promise<ApiResponse> {
    return post('/payments/retry', { participantId, contestId }, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}
    });
}

/**
 * GET /payments/status/:participantId
 * Public: Check payment status
 */
export async function getPaymentStatus(participantId: string): Promise<ApiResponse> {
    return get(`/payments/status/${participantId}`);
}

/**
 * GET /payments/events/:contestId
 * Admin: List all payments for a contest
 */
export async function listPayments(
    contestId: string,
    params?: {
        status?: string;
        page?: number;
        limit?: number;
    }
): Promise<ApiResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const path = `/payments/events/${contestId}${query.toString() ? '?' + query.toString() : ''}`;
    return get(path);
}

/**
 * GET /payments/:paymentId
 * Admin: Get single payment detail
 */
export async function getPaymentDetail(paymentId: string): Promise<ApiResponse> {
    return get(`/payments/${paymentId}`);
}


export type RazorpayPaymentStatus = "CREATED" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED";

/** GET /payments/participants/:participantId/details — mirrors backend ParticipantPaymentDetails. */
export interface ParticipantPaymentDetails {
    payment: {
        id: string;
        status: RazorpayPaymentStatus;
        amount: number; // paise
        currency: string;
        razorpayOrderId: string | null;
        razorpayPaymentId: string | null;
        failureReason: string | null;
        attempts: number;
        webhookConfirmed: boolean;
        paidAt: string | null;
        createdAt: string;
        updatedAt: string;
    } | null;
    orders: {
        razorpayOrderId: string;
        status: RazorpayPaymentStatus;
        razorpayPaymentId: string | null;
        method: string | null;
        failureReason: string | null;
        errorCode: string | null;
        errorReason: string | null;
        isCurrent: boolean;
        createdAt: string;
        updatedAt: string;
    }[];
    razorpayReceipts: { original: string; retry: string };
}

/** Admin: full payment picture (every Razorpay order) for one registration. */
export async function getParticipantPaymentDetails(participantId: string): Promise<ApiResponse<ParticipantPaymentDetails>> {
    return get<ParticipantPaymentDetails>(`/payments/participants/${participantId}/details`);
}

/** POST /payments/participants/:participantId/razorpay-lookup — mirrors backend RazorpayVerificationPreview. */
export interface RazorpayVerificationPreview {
    razorpay: {
        paymentId: string;
        orderId: string;
        status: string;
        amount: number; // paise
        currency: string;
        method: string | null;
        vpa: string | null;
        bankRrn: string | null;
        email: string | null;
        contact: string | null;
        createdAt: string;
        errorDescription: string | null;
    };
    checks: { label: string; ok: boolean; detail: string }[];
    canConfirm: boolean;
}

/** Admin step 1: what Razorpay has for this ID and whether it can be accepted. Changes nothing. */
export async function previewRazorpayPayment(participantId: string, reference: string): Promise<ApiResponse<RazorpayVerificationPreview>> {
    return post<RazorpayVerificationPreview>(`/payments/participants/${participantId}/razorpay-lookup`, { reference });
}

/**
 * Admin step 2: settle a registration from a Razorpay payment ID (pay_…) or order ID (order_…).
 * The backend verifies it live with Razorpay (captured, amount, belongs to this participant).
 */
export async function verifyRazorpayPayment(participantId: string, reference: string): Promise<ApiResponse<ParticipantPaymentDetails>> {
    return post<ParticipantPaymentDetails>(`/payments/participants/${participantId}/verify-razorpay`, { reference });
}
