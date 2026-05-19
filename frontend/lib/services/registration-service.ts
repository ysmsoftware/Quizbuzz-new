// lib/services/registration-service.ts
// ────────────────────────────────────────────────────────────────
// Real 3-step OTP registration flow.
//
// Step 1: POST /auth/quiz/request-otp   → sends OTP to email
// Step 2: POST /auth/quiz/verify-otp    → returns contactToken
// Step 3: POST /contests/register/:slug → registers participant
// ────────────────────────────────────────────────────────────────

import type { RegistrationResult } from '@/lib/types/public-contest';

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
    }
  ): Promise<{ success: boolean; data: RegistrationResult }> {
    return publicPost<{ success: boolean; data: RegistrationResult }>(
      `/contests/register/${contestSlug}`,
      payload
    );
  }
}

export const registrationService = new RegistrationService();
