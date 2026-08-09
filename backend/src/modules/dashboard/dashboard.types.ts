import { ContestStatus, ParticipantStatus } from "@prisma/client";

// ─── Query DTOs (parsed from req.query by dashboard.validator.ts) ─────────────

export interface OverviewQuery {
    period: "week" | "month";
}

export type UpcomingContestsSortBy = "startTime" | "registrationDeadline" | "createdAt";
export type SortOrder = "asc" | "desc";

export interface UpcomingContestsQuery {
    limit: number;
    statuses: ContestStatus[];
    sortBy: UpcomingContestsSortBy;
    sortOrder: SortOrder;
}

export type RecentRegistrationsSortBy = "createdAt" | "status";

export interface RecentRegistrationsQuery {
    limit: number;
    page: number;
    sortBy: RecentRegistrationsSortBy;
    sortOrder: SortOrder;
    contestId?: string | undefined;
    status?: ParticipantStatus | undefined;
}

export interface RegistrationTrendQuery {
    days: number;
}

export interface ContestsByStatusQuery {
    includeArchived: boolean;
}

// ─── Result DTOs ────────────────────────────────────────────────────────────

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
        /** Main currency unit (e.g. rupees, not paise) — see Payment.amount comment. */
        total: number;
        thisPeriod: number;
        currency: string;
    };
    period: {
        type: "week" | "month";
        start: Date;
        end: Date;
    };
}

export interface UpcomingContestSummary {
    id: string;
    title: string;
    slug: string;
    status: ContestStatus;
    startTime: Date;
    registrationDeadline: Date;
    endTime: Date;
    maxParticipants: number | null;
    registeredCount: number;
}

export interface RecentRegistrationEntry {
    id: string;
    registrationRef: string;
    status: ParticipantStatus;
    createdAt: Date;
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

export type ContestsByStatusResult = Record<ContestStatus, number>;

export interface RegistrationTrendPoint {
    /** ISO date (YYYY-MM-DD), UTC calendar day. */
    date: string;
    count: number;
}
