// lib/services/ambassador-service.ts
// ────────────────────────────────────────────────────────────────
// Ambassador Program — public + ambassador-authenticated data layer.
// Mirrors registration-service.ts's shape: raw fetch, credentials:'include'
// (the ambassador session is an httpOnly `ambassadorToken` cookie, a
// different token from the org-admin session apiClient.ts manages, so this
// intentionally does not go through apiClient's 401/admin-refresh logic).
//
// Platform-level identity: an ambassador signs up once (no organizationId
// anywhere in this file) and browses/applies to campaigns across every
// organization — mirrors how /contests isn't scoped to one org either.
// ────────────────────────────────────────────────────────────────

import type {
  AmbassadorTypeDefinition,
  Ambassador,
  AvailableCampaignItem,
  MyCampaignItem,
  CampaignStatsDetail,
  EnrollmentResult,
  LeaderboardScope,
  LeaderboardEntryResult,
  PaginatedResult,
} from '@/lib/types/ambassador';
import { leaderboardScopeQueryParams } from '@/lib/types/ambassador';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

/**
 * Preserves the structured parts of a failed ambassador-API response — the
 * plain `Error` this replaced discarded `code`/`violations`/`details`/`email`,
 * which is exactly what a caller needs to highlight the offending form field
 * instead of just showing the top-level message in a toast.
 */
export class AmbassadorApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly violations?: { field: string; issue: string }[],
    public readonly details?: Record<string, string[]>,
    public readonly email?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AmbassadorApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new AmbassadorApiError(
      data.message || `Request failed: ${res.status}`,
      data.code,
      data.violations,
      data.details,
      data.email,
      res.status,
    );
  }
  return data.data ?? data;
}

const publicGet = <T>(path: string, params?: Record<string, string | number | undefined>) => {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]).toString()
    : '';
  return request<T>(`${path}${qs}`, { method: 'GET' });
};

const publicPost = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });

class AmbassadorService {
  // ── Public (/api/v1/public/ambassador) ────────────────────────────────────

  /** Org-scoped — which ambassador types THIS org has enabled (campaign config screens). */
  getTypes(organizationId: string) {
    return publicGet<AmbassadorTypeDefinition[]>('/public/ambassador/types', { organizationId });
  }

  /** Platform-wide — every active type, used at signup before any org relationship exists. */
  getPlatformTypes() {
    return publicGet<AmbassadorTypeDefinition[]>('/public/ambassador/platform-types');
  }

  requestUploadUrl(body: { filename: string; mimeType: string }) {
    return publicPost<{ storageKey: string; url: string }>('/public/ambassador/upload-proof', body);
  }

  // ── Signup (2-step platform identity) ──────────────────────────────────────

  signupStart(body: { firstName: string; lastName?: string; email: string; phone?: string }) {
    return publicPost<void>('/public/ambassador/signup/start', body);
  }

  signupVerifyOtp(body: { email: string; otp: string }) {
    return publicPost<{ firstName: string; lastName: string | null; phone: string | null }>(
      '/public/ambassador/signup/verify-otp',
      body,
    );
  }

  signupComplete(body: {
    email: string;
    ambassadorType: string;
    applicationData: Record<string, string>;
    proofStorageKey: string;
    proofUrl: string;
  }) {
    return publicPost<{ expiresIn: number }>('/public/ambassador/signup/complete', body);
  }

  // ── Login (returning ambassador) ────────────────────────────────────────────

  requestOtp(email: string) {
    return publicPost<void>('/public/ambassador/auth/request-otp', { email });
  }

  verifyOtp(email: string, otp: string) {
    return publicPost<{ expiresIn: number }>('/public/ambassador/auth/verify-otp', { email, otp });
  }

  // ── Ambassador-authenticated (/api/v1/ambassador, ambassadorToken cookie) ──

  getMe() {
    return request<Ambassador>('/ambassador/me', { method: 'GET' });
  }

  updateProfile(body: { firstName?: string; lastName?: string | null; phone?: string }) {
    return request<Ambassador>('/ambassador/me', { method: 'PATCH', body: JSON.stringify(body) });
  }

  logout() {
    return publicPost<void>('/ambassador/logout');
  }

  requestAuthenticatedUploadUrl(body: { filename: string; mimeType: string }) {
    return publicPost<{ storageKey: string; url: string }>('/ambassador/upload-proof', body);
  }

  updateProof(body: { proofStorageKey: string; proofUrl: string }) {
    return request<Ambassador>('/ambassador/me/proof', { method: 'PATCH', body: JSON.stringify(body) });
  }

  getAvailableCampaigns(params?: { page?: number; limit?: number }) {
    return publicGet<PaginatedResult<AvailableCampaignItem>>('/ambassador/campaigns/available', params);
  }

  getMyCampaigns(params?: { page?: number; limit?: number }) {
    return publicGet<PaginatedResult<MyCampaignItem>>('/ambassador/campaigns/mine', params);
  }

  applyToCampaign(campaignId: string) {
    return publicPost<EnrollmentResult>(`/ambassador/campaigns/${campaignId}/apply`);
  }

  getCampaignStats(campaignId: string) {
    return request<CampaignStatsDetail>(`/ambassador/campaigns/${campaignId}/stats`, { method: 'GET' });
  }

  getCampaignLeaderboard(
    campaignId: string,
    scope: LeaderboardScope,
    params?: { page?: number; limit?: number }
  ) {
    return publicGet<PaginatedResult<LeaderboardEntryResult>>(`/ambassador/campaigns/${campaignId}/leaderboard`, {
      ...leaderboardScopeQueryParams(scope),
      ...params,
    });
  }
}

export const ambassadorService = new AmbassadorService();
