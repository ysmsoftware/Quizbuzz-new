/**
 * Admin Authentication API Functions
 * 
 * Maps directly to 01-auth.md endpoints.
 * These are plain async functions (not hooks) that return the raw server response.
 */

import { get, post } from './apiClient';
import type { ApiResponse } from './apiClient';

/**
 * POST /auth/admin/register
 */
export async function registerAdmin(body: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<ApiResponse> {
  return post('/auth/admin/register', body);
}

/**
 * POST /auth/admin/login
 * Uses raw fetch so a wrong password 401 is not treated as "session expired".
 */
export async function loginAdmin(body: {
  email: string;
  password: string;
}): Promise<ApiResponse> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
  const res = await fetch(`${API_BASE}/auth/admin/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    const { ApiRequestError } = await import('./apiClient');
    throw new ApiRequestError(
      data.code ?? 'LOGIN_FAILED',
      data.message ?? 'Incorrect email or password',
      data.details,
      data.requestId,
      res.status,
    );
  }

  return data;
}

/**
 * POST /auth/admin/logout
 */
export async function logoutAdmin(): Promise<ApiResponse> {
  return post('/auth/admin/logout');
}

/**
 * POST /auth/admin/logout-all
 */
export async function logoutAllDevices(): Promise<ApiResponse> {
  return post('/auth/admin/logout-all');
}

/**
 * POST /auth/admin/refresh
 */
export async function refreshToken(): Promise<ApiResponse> {
  return post('/auth/admin/refresh');
}

/**
 * POST /auth/admin/verify-email
 */
export async function verifyEmail(body: { email: string; otp: string }): Promise<ApiResponse> {
  return post('/auth/admin/verify-email', body);
}

/**
 * POST /auth/admin/resend-verification
 */
export async function resendVerificationOtp(email: string): Promise<ApiResponse> {
  return post('/auth/admin/resend-verification', { email });
}

/**
 * POST /auth/admin/forgot-password
 */
export async function forgotPassword(email: string): Promise<ApiResponse> {
  return post('/auth/admin/forgot-password', { email });
}

/**
 * POST /auth/admin/reset-password
 */
export async function resetPassword(token: string, newPassword: string): Promise<ApiResponse> {
  return post('/auth/admin/reset-password', { token, newPassword });
}

/**
 * GET /auth/admin/me
 */
export async function getMe(): Promise<ApiResponse> {
  return get('/auth/admin/me');
}

/**
 * POST /auth/admin/switch-org
 */
export async function switchOrg(organizationId: string): Promise<ApiResponse> {
  return post('/auth/admin/switch-org', { organizationId });
}

/**
 * GET /auth/admin/socket-token
 * Returns a short-lived JWT for authenticating the admin WebSocket (/quiz-admin namespace).
 * Must be called before connecting the admin socket — the token expires in 5 minutes.
 */
export async function getAdminSocketToken(): Promise<ApiResponse<{ socketToken: string; expiresIn: number }>> {
  return get<{ socketToken: string; expiresIn: number }>('/auth/admin/socket-token');
}
