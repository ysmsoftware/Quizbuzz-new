// lib/services/registration-service.ts
// ────────────────────────────────────────────────────────────────
// Registration + payment flow.
//
// Step 1: POST /auth/quiz/request-otp     → sends OTP to email
// Step 2: POST /auth/quiz/verify-otp      → returns contactToken
// Step 3: POST /contests/register/:slug   → registers participant
// Step 4: POST /payments/create-order     → creates Razorpay order
// Step 5: (Razorpay SDK opens checkout — UPI redirects to payment app)
// Step 6: GET  /payments/status/:pid      → poll until SUCCESS or FAILED
//             (webhook is the source of truth; this just reads DB status)
// ────────────────────────────────────────────────────────────────

import type { RegistrationResult } from '@/lib/types/public-contest';

export interface RazorpayOrderResult {
  orderId: string;
  amount: number;    // in paise
  currency: string;
  keyId: string;
  paymentId: string; // our DB payment record id
}

export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export interface ExistingRegistrationInfo {
  participantId: string;
  registrationRef: string;
  status: 'REGISTERED' | 'PENDING_PAYMENT';
  payment?: {
    status: string;
    ageMs: number;
    resumable: boolean;
  };
}

export interface PaymentStatusResult {
  status: PaymentStatus;
  webhookConfirmed: boolean;
  failureReason: string | null;
}

/**
 * Profile fields from a Contact the participant already has on file (from a
 * prior registration, any contest in this org). Used to prefill the details
 * form for a returning participant instead of asking them to retype
 * everything — fields stay editable, this is a prefill, not a lock.
 */
export interface KnownContactInfo {
  firstName: string;
  lastName: string | null;
  phone: string | null;
  college: string | null;
  department: string | null;
  city: string | null;
  state: string | null;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
  return data;
}

class RegistrationService {
  /** Step 1: Send OTP to email */
  async requestOtp(email: string) {
    return publicPost<{ success: boolean; message: string }>(
      '/auth/quiz/request-otp',
      { email }
    );
  }

  /** Step 2: Verify OTP → get contactToken */
  async verifyOtp(
    email: string,
    otp: string
  ): Promise<{ contactToken: string; expiresIn: number }> {
    const res = await publicPost<{
      success: boolean;
      data: { contactToken: string; expiresIn: number };
    }>('/auth/quiz/verify-otp', { email, otp });
    return res.data;
  }

  /**
   * Check existing registration status using contactToken. `phone` is
   * optional and only meaningful once a full 10-digit number has been
   * typed — passing it lets a contact match found by PHONE (not just by
   * email) also trigger the knownContact prefill. See registration audit,
   * issue A.
   */
  async checkRegistrationStatus(
    contestSlug: string,
    contactToken: string,
    phone?: string
  ): Promise<{ existing: ExistingRegistrationInfo | null; knownContact?: KnownContactInfo }> {
    const res = await publicPost<{
      success: boolean;
      data: { existing: ExistingRegistrationInfo | null; knownContact?: KnownContactInfo };
    }>(`/contests/register-status/${contestSlug}`, { contactToken, ...(phone ? { phone } : {}) });
    return res.data;
  }

  /** Step 3: Register for contest */
  async registerForContest(
    contestSlug: string,
    payload: {
      contactToken: string;
      email: string;
      phone?: string;
      firstName: string;
      lastName?: string;
      college?: string;
      department?: string;
      city?: string;
      state?: string;
      /** Ambassador Program referral code, from the `?ref=` query param on the register link. */
      referralCode?: string;
      /** Values for the contest's organizer-defined registrationFields, keyed by field id. */
      customFields?: Record<string, string>;
    }
  ): Promise<{ success: boolean; data: RegistrationResult }> {
    return publicPost<{ success: boolean; data: RegistrationResult }>(
      `/contests/register/${contestSlug}`,
      payload
    );
  }

  /**
   * Step 4: Create a Razorpay order for a pending participant.
   * Returns orderId, amount (paise), currency, keyId, and our DB paymentId.
   */
  async createPaymentOrder(
    contestId: string,
    participantId: string
  ): Promise<RazorpayOrderResult> {
    const res = await publicPost<{ success: boolean; data: RazorpayOrderResult }>(
      '/payments/create-order',
      { contestId, participantId }
    );
    return res.data;
  }

  /**
   * Step 6: Poll payment status.
   * Called repeatedly after the Razorpay modal closes on ANY device.
   * The webhook is the source of truth — this endpoint just reads the DB.
   * Poll until status is SUCCESS or FAILED (or timeout).
   */
  async checkPaymentStatus(participantId: string): Promise<PaymentStatusResult> {
    const res = await fetch(`${BASE}/payments/status/${participantId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to check payment status');
    return data.data as PaymentStatusResult;
  }
}

export const registrationService = new RegistrationService();
