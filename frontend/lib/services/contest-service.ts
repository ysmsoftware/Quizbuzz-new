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

async function publicGet<T>(path: string): Promise<{ success: true; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    next: { revalidate: 60 }, // Next.js ISR — re-fetch every 60s
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
  async getContestBySlug(slug: string) {
    try {
      const res = await publicGet<PublicContestDetail>(`/contests/public/${slug}`);
      return { success: true as const, data: res.data };
    } catch {
      return { success: false as const, data: undefined, error: 'Contest not found' };
    }
  }
}

export const contestService = new ContestService();
