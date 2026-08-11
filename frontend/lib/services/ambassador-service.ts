// lib/services/ambassador-service.ts
// ────────────────────────────────────────────────────────────────
// Ambassador Program — public + ambassador-authenticated data layer.
// Mirrors registration-service.ts's shape: raw fetch, credentials:'include'
// (the ambassador session is an httpOnly `ambassadorToken` cookie, a
// different token from the org-admin session apiClient.ts manages, so this
// intentionally does not go through apiClient's 401/admin-refresh logic).
//
// NOTE: the frontend route is /ambassador/[orgSlug]/..., but the backend
// contract takes an `organizationId` param, not a slug. Until the backend
// exposes a public slug→id lookup, `orgSlug` is passed straight through as
// `organizationId` — flagged as a divergence to confirm with the backend.
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

  getTypes(organizationId: string) {
    return publicGet<AmbassadorTypeDefinition[]>('/public/ambassador/types', { organizationId });
  }

  requestUploadUrl(body: { organizationId: string; filename: string; mimeType: string }) {
    return publicPost<{ storageKey: string; url: string }>('/public/ambassador/upload-proof', body);
  }

  apply(body: {
    organizationId: string;
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    ambassadorType: string;
    applicationData: Record<string, string>;
    proofStorageKey: string;
    proofUrl: string;
  }) {
    return publicPost<Ambassador>('/public/ambassador/apply', body);
  }

  requestOtp(email: string, organizationId: string) {
    return publicPost<void>('/public/ambassador/auth/request-otp', { email, organizationId });
  }

  verifyOtp(email: string, organizationId: string, otp: string) {
    return publicPost<{ status: Ambassador['status']; expiresIn: number }>('/public/ambassador/auth/verify-otp', {
      email,
      organizationId,
      otp,
    });
  }

  // ── Ambassador-authenticated (/api/v1/ambassador, ambassadorToken cookie) ──

  getMe() {
    return request<Ambassador>('/ambassador/me', { method: 'GET' });
  }

  getAvailableCampaigns(params?: { page?: number; limit?: number }) {
    return publicGet<PaginatedResult<AvailableCampaignItem>>('/ambassador/campaigns/available', params);
  }

  getMyCampaigns(params?: { page?: number; limit?: number }) {
    return publicGet<PaginatedResult<MyCampaignItem>>('/ambassador/campaigns/mine', params);
  }

  joinCampaign(campaignId: string) {
    return publicPost<EnrollmentResult>(`/ambassador/campaigns/${campaignId}/join`);
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
      scope,
      ...params,
    });
  }
}

export const ambassadorService = new AmbassadorService();
