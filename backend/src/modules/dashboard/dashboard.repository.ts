import { ContestStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import {
    ContestsByStatusResult,
    RecentRegistrationEntry,
    RecentRegistrationsQuery,
    RegistrationTrendPoint,
    UpcomingContestSummary,
    UpcomingContestsQuery,
} from "./dashboard.types";

/**
 * Pure read queries for the org dashboard. No business logic, no request/response
 * shaping beyond mapping a Prisma row onto the module's result DTOs — that belongs
 * in DashboardService.
 */
export class DashboardRepository {
    async getContestCountsByStatus(
        organizationId: string,
        includeArchived: boolean,
    ): Promise<ContestsByStatusResult> {
        const grouped = await prisma.contest.groupBy({
            by: ["status"],
            where: {
                organizationId,
                isDeleted: false,
                ...(includeArchived ? {} : { isArchived: false }),
            },
            _count: { _all: true },
        });

        // Zero-fill every status so callers never have to guess whether a
        // missing key means "zero" or "not computed yet".
        const result = Object.values(ContestStatus).reduce((acc, status) => {
            acc[status] = 0;
            return acc;
        }, {} as ContestsByStatusResult);

        for (const row of grouped) {
            result[row.status] = row._count._all;
        }

        return result;
    }

    async getContestTotals(
        organizationId: string,
        periodStart: Date,
    ): Promise<{ total: number; liveNow: number; createdThisPeriod: number }> {
        const [total, liveNow, createdThisPeriod] = await Promise.all([
            prisma.contest.count({
                where: { organizationId, isDeleted: false, isArchived: false },
            }),
            prisma.contest.count({
                where: { organizationId, isDeleted: false, status: ContestStatus.LIVE },
            }),
            prisma.contest.count({
                where: {
                    organizationId,
                    isDeleted: false,
                    isArchived: false,
                    createdAt: { gte: periodStart },
                },
            }),
        ]);

        return { total, liveNow, createdThisPeriod };
    }

    async getRegistrationTotals(
        organizationId: string,
        periodStart: Date,
    ): Promise<{ total: number; newThisPeriod: number }> {
        const [total, newThisPeriod] = await Promise.all([
            prisma.participant.count({ where: { organizationId } }),
            prisma.participant.count({
                where: { organizationId, createdAt: { gte: periodStart } },
            }),
        ]);

        return { total, newThisPeriod };
    }

    async getRevenueTotals(
        organizationId: string,
        periodStart: Date,
    ): Promise<{ total: number; thisPeriod: number }> {
        const [totalAgg, periodAgg] = await Promise.all([
            prisma.payment.aggregate({
                where: { organizationId, status: "SUCCESS" },
                _sum: { amount: true },
            }),
            prisma.payment.aggregate({
                where: { organizationId, status: "SUCCESS", paidAt: { gte: periodStart } },
                _sum: { amount: true },
            }),
        ]);

        return {
            // amount is stored in paise — convert to the main currency unit.
            total: Number(totalAgg._sum.amount || 0) / 100,
            thisPeriod: Number(periodAgg._sum.amount || 0) / 100,
        };
    }

    async findUpcomingContests(
        organizationId: string,
        query: UpcomingContestsQuery,
    ): Promise<UpcomingContestSummary[]> {
        const contests = await prisma.contest.findMany({
            where: {
                organizationId,
                isDeleted: false,
                isArchived: false,
                status: { in: query.statuses },
            },
            orderBy: { [query.sortBy]: query.sortOrder },
            take: query.limit,
            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                startTime: true,
                registrationDeadline: true,
                endTime: true,
                maxParticipants: true,
                _count: { select: { participants: true } },
            },
        });

        return contests.map((c) => ({
            id: c.id,
            title: c.title,
            slug: c.slug,
            status: c.status,
            startTime: c.startTime,
            registrationDeadline: c.registrationDeadline,
            endTime: c.endTime,
            maxParticipants: c.maxParticipants,
            registeredCount: c._count.participants,
        }));
    }

    async findRecentRegistrations(
        organizationId: string,
        query: RecentRegistrationsQuery,
    ): Promise<{ data: RecentRegistrationEntry[]; total: number }> {
        const skip = (query.page - 1) * query.limit;

        const where: Prisma.ParticipantWhereInput = {
            organizationId,
            ...(query.contestId ? { contestId: query.contestId } : {}),
            ...(query.status ? { status: query.status } : {}),
        };

        const [rows, total] = await prisma.$transaction([
            prisma.participant.findMany({
                where,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take: query.limit,
                select: {
                    id: true,
                    registrationRef: true,
                    status: true,
                    createdAt: true,
                    contact: {
                        select: { id: true, firstName: true, lastName: true, email: true },
                    },
                    contest: {
                        select: { id: true, title: true, slug: true },
                    },
                },
            }),
            prisma.participant.count({ where }),
        ]);

        return {
            data: rows.map((r) => ({
                id: r.id,
                registrationRef: r.registrationRef,
                status: r.status,
                createdAt: r.createdAt,
                contact: r.contact,
                contest: r.contest,
            })),
            total,
        };
    }

    /**
     * Daily registration counts for the trailing `days` days (inclusive of today),
     * zero-filled so the chart never has to guess whether a missing day means "no
     * data" or "zero registrations".
     */
    async getRegistrationTrend(organizationId: string, days: number): Promise<RegistrationTrendPoint[]> {
        const rows = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
            SELECT to_char(d::date, 'YYYY-MM-DD') as date, COALESCE(COUNT(p.id), 0) as count
            FROM generate_series(
                (CURRENT_DATE - (${days - 1} || ' days')::interval),
                CURRENT_DATE,
                '1 day'::interval
            ) d
            LEFT JOIN participants p
                ON p."organizationId" = ${organizationId}
                AND date_trunc('day', p."createdAt") = d
            GROUP BY d
            ORDER BY d ASC
        `;

        return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
    }
}
