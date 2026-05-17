/**
 * Public Participant Registration API Functions
 * 
 * Maps directly to 05-public-registration.md endpoints.
 * No admin auth required — contactToken is used instead.
 * Base path: /auth/quiz and /contests
 */

import { post } from './apiClient';
import type { ApiResponse } from './apiClient';

/**
 * POST /auth/quiz/request-otp
 * Send OTP to participant email
 */
export async function requestOtp(email: string): Promise<ApiResponse> {
  return post('/auth/quiz/request-otp', { email });
}

/**
 * POST /auth/quiz/verify-otp
 * Verify OTP and get contactToken
 */
export async function verifyOtp(email: string, otp: string): Promise<ApiResponse> {
  return post('/auth/quiz/verify-otp', { email, otp });
}

/**
 * POST /contests/register/:contestSlug
 * Register participant for contest
 */
export async function registerForContest(
  contestSlug: string,
  body: {
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
): Promise<ApiResponse> {
  return post(`/contests/register/${contestSlug}`, body);
}
