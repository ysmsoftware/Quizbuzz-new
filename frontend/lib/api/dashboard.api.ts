/**
 * Org Dashboard API functions
 *
 * Maps to backend/src/modules/dashboard/*. Base path: /org/:orgId/dashboard
 * Every list/filter/sort knob here is a real query param — nothing is hardcoded
 * on the client, it all round-trips to the backend's zod-validated query schema.
 */

import { get } from './apiClient';
import type { ApiResponse } from './apiClient';

// ─── Shared enums (mirror backend @prisma/client enums) ───────────────────────

export type ContestStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'REGISTRATION_CLOSED'
  | 'LIVE'
  | 'EVALUATION'
  | 'RESULTS_OUT'
  | 'COMPLETED'
  | 'CANCELLED';

export type ParticipantStatus =
  | 'PENDING_PAYMENT'
  | 'REGISTERED'
  | 'CHECKED_IN'
  | 'IN_WAITING'
  | 'IN_QUIZ'
  | 'SUBMITTED'
  | 'DISQUALIFIED'
  | 'ABSENT';

export type SortOrder = 'asc' | 'desc';

// ─── Overview ───────────────────────────────────────────────────────────────

export interface DashboardOverview {
  contests: {
    total: number;
    liveNow: number;
    createdThisPeriod: number;
    byStatus: Record<ContestStatus, number>;
  };
  registrations: {
    total: number;
    newThisPeriod: number;
  };
  revenue: {
    total: number;
    thisPeriod: number;
    currency: string;
  };
  period: {
    type: 'week' | 'month';
    start: string;
    end: string;
  };
}

export async function getDashboardOverview(
  orgId: string,
  params?: { period?: 'week' | 'month' }
): Promise<ApiResponse<DashboardOverview>> {
  return get(`/org/${orgId}/dashboard/overview`, { params });
}

// ─── Upcoming contests ──────────────────────────────────────────────────────

export interface UpcomingContest {
  id: string;
  title: string;
  slug: string;
  status: ContestStatus;
  startTime: string;
  registrationDeadline: string;
  endTime: string;
  maxParticipants: number | null;
  registeredCount: number;
}

export async function getUpcomingContests(
  orgId: string,
  params?: {
    limit?: number;
    status?: ContestStatus | ContestStatus[];
    sortBy?: 'startTime' | 'registrationDeadline' | 'createdAt';
    sortOrder?: SortOrder;
  }
): Promise<ApiResponse<UpcomingContest[]>> {
  const status = Array.isArray(params?.status) ? params?.status.join(',') : params?.status;
  return get(`/org/${orgId}/dashboard/upcoming-contests`, {
    params: { ...params, status },
  });
}

// ─── Recent registrations ───────────────────────────────────────────────────

export interface RecentRegistration {
  id: string;
  registrationRef: string;
  status: ParticipantStatus;
  createdAt: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
  };
  contest: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface RecentRegistrationsResult {
  data: RecentRegistration[];
  total: number;
  page: number;
  limit: number;
}

export async function getRecentRegistrations(
  orgId: string,
  params?: {
    limit?: number;
    page?: number;
    sortBy?: 'createdAt' | 'status';
    sortOrder?: SortOrder;
    contestId?: string;
    status?: ParticipantStatus;
  }
): Promise<ApiResponse<RecentRegistrationsResult>> {
  return get(`/org/${orgId}/dashboard/recent-registrations`, { params });
}

// ─── Registration trend ─────────────────────────────────────────────────────

export interface RegistrationTrendPoint {
  date: string;
  count: number;
}

export async function getRegistrationTrend(
  orgId: string,
  params?: { days?: number }
): Promise<ApiResponse<RegistrationTrendPoint[]>> {
  return get(`/org/${orgId}/dashboard/registration-trend`, { params });
}

// ─── Contests by status ─────────────────────────────────────────────────────

export type ContestsByStatus = Record<ContestStatus, number>;

export async function getContestsByStatus(
  orgId: string,
  params?: { includeArchived?: boolean }
): Promise<ApiResponse<ContestsByStatus>> {
  return get(`/org/${orgId}/dashboard/contests-by-status`, { params });
}
