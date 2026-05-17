/**
 * Payment API Functions
 * 
 * Maps directly to 06-payment.md endpoints.
 * Base path: /payments
 */

import { get, post, patch } from './apiClient';
import type { ApiResponse } from './apiClient';

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

/**
 * POST /payments/:paymentId/refund
 * Admin: Issue a refund
 */
export async function refundPayment(
  paymentId: string,
  reason: string
): Promise<ApiResponse> {
  return post(`/payments/${paymentId}/refund`, { reason });
}
