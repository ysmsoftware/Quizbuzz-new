// lib/services/contest-service.ts
// ────────────────────────────────────────────────────────────────
// Real HTTP client for public contest endpoints.
// No auth required — these hit /contests/public routes.
// ────────────────────────────────────────────────────────────────

import type {
  PublicContestSummary,
  PublicContestDetail,
} from '@/lib/types/public-contest';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

async function publicGet<T>(
  path: string,
  opts?: { fresh?: boolean },
): Promise<{ success: true; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    // `fresh` bypasses the ISR cache entirely. Required for live-critical reads
    // (waiting-room status polling, server clock sync) — a 60s-stale response
    // would make a 3s poll interval meaningless and would hand back a stale
    // `serverTime`, breaking clock-offset math.
    ...(opts?.fresh
      ? { cache: 'no-store' as const }
      : { next: { revalidate: 60 } }), // Next.js ISR — re-fetch every 60s
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

class ContestService {
  /**
   * Fetch all publicly visible contests with optional search + pagination.
   */
  async getContests(params?: { search?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.page)   qs.set('page',   String(params.page));
    if (params?.limit)  qs.set('limit',  String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';

    const res = await publicGet<{
      data: PublicContestSummary[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/contests/public${query}`);

    return {
      success: true as const,
      data: res.data.data,
      pagination: res.data.pagination,
    };
  }

  /**
   * Fetch a single contest by slug — for the public detail page.
   */
  /**
   * @param opts.fresh — bypass the ISR cache. Pass `true` from the waiting room
   * and any other place that needs live contest status or an accurate serverTime.
   * @param opts.ref — an ambassador referral code (the registration link's ?ref= param).
   * When it resolves to a valid, approved, live enrollment, the response's
   * `referralPreview` carries that campaign's poster/name for a WhatsApp/social link
   * preview card — see the register page's generateMetadata.
   */
  async getContestBySlug(slug: string, opts?: { fresh?: boolean; ref?: string }) {
    try {
      const qs = opts?.ref ? `?ref=${encodeURIComponent(opts.ref)}` : '';
      const res = await publicGet<PublicContestDetail>(`/contests/public/${slug}${qs}`, { fresh: opts?.fresh });
      return { success: true as const, data: res.data };
    } catch {
      return { success: false as const, data: undefined, error: 'Contest not found' };
    }
  }
}

export const contestService = new ContestService();
