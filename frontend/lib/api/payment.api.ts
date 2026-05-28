
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
    idempotencyKey?: string
): Promise<ApiResponse> {
    return post('/payments/retry', { participantId }, {
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

