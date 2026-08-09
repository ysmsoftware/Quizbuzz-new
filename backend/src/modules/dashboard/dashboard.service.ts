import { DashboardRepository } from "./dashboard.repository";
import { redis } from "../../config/redis";
import { config } from "../../config";
import logger from "../../config/logger";
import {
    ContestsByStatusQuery,
    ContestsByStatusResult,
    DashboardOverview,
    OverviewQuery,
    RecentRegistrationEntry,
    RecentRegistrationsQuery,
    RegistrationTrendPoint,
    RegistrationTrendQuery,
    UpcomingContestSummary,
    UpcomingContestsQuery,
} from "./dashboard.types";

const OVERVIEW_CACHE_KEY = (organizationId: string, period: string) =>
    `dashboard:overview:${organizationId}:${period}`;

/**
 * Assembles the org dashboard's read models. Every method here is org-scoped by
 * organizationId — the caller (controller) is responsible for proving that id
 * belongs to the authenticated admin before this service is ever invoked.
 */
export class DashboardService {
    constructor(private readonly repository: DashboardRepository) { }

    async getOverview(organizationId: string, query: OverviewQuery): Promise<DashboardOverview> {
        const cacheKey = OVERVIEW_CACHE_KEY(organizationId, query.period);

        const cached = await this._readCache<DashboardOverview>(cacheKey);
        if (cached) return cached;

        const { start, end } = this._resolvePeriod(query.period);

        const [byStatus, contestTotals, registrationTotals, revenueTotals] = await Promise.all([
            this.repository.getContestCountsByStatus(organizationId, false),
            this.repository.getContestTotals(organizationId, start),
            this.repository.getRegistrationTotals(organizationId, start),
            this.repository.getRevenueTotals(organizationId, start),
        ]);

        const overview: DashboardOverview = {
            contests: {
                total: contestTotals.total,
                liveNow: contestTotals.liveNow,
                createdThisPeriod: contestTotals.createdThisPeriod,
                byStatus,
            },
            registrations: {
                total: registrationTotals.total,
                newThisPeriod: registrationTotals.newThisPeriod,
            },
            revenue: {
                total: revenueTotals.total,
                thisPeriod: revenueTotals.thisPeriod,
                currency: config.payment.currency,
            },
            period: { type: query.period, start, end },
        };

        await this._writeCache(cacheKey, overview);
        return overview;
    }

    async getUpcomingContests(
        organizationId: string,
        query: UpcomingContestsQuery,
    ): Promise<UpcomingContestSummary[]> {
        return this.repository.findUpcomingContests(organizationId, query);
    }

    async getRecentRegistrations(
        organizationId: string,
        query: RecentRegistrationsQuery,
    ): Promise<{ data: RecentRegistrationEntry[]; total: number; page: number; limit: number }> {
        const { data, total } = await this.repository.findRecentRegistrations(organizationId, query);
        return { data, total, page: query.page, limit: query.limit };
    }

    async getRegistrationTrend(
        organizationId: string,
        query: RegistrationTrendQuery,
    ): Promise<RegistrationTrendPoint[]> {
        return this.repository.getRegistrationTrend(organizationId, query.days);
    }

    async getContestsByStatus(
        organizationId: string,
        query: ContestsByStatusQuery,
    ): Promise<ContestsByStatusResult> {
        return this.repository.getContestCountsByStatus(organizationId, query.includeArchived);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private _resolvePeriod(period: "week" | "month"): { start: Date; end: Date } {
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - (period === "week" ? 7 : 30));
        return { start, end };
    }

    private async _readCache<T>(key: string): Promise<T | null> {
        if (config.dashboard.overviewCacheTtlSeconds <= 0) return null;
        try {
            const raw = await redis.get(key);
            if (!raw) return null;
            return JSON.parse(raw) as T;
        } catch (err) {
            // Cache is a performance optimization, not a source of truth — a
            // Redis hiccup should degrade to "recompute", never break the request.
            logger.warn(`[dashboard-service] Cache read failed for ${key}: ${(err as Error).message}`);
            return null;
        }
    }

    private async _writeCache(key: string, value: unknown): Promise<void> {
        if (config.dashboard.overviewCacheTtlSeconds <= 0) return;
        try {
            await redis.setex(key, config.dashboard.overviewCacheTtlSeconds, JSON.stringify(value));
        } catch (err) {
            logger.warn(`[dashboard-service] Cache write failed for ${key}: ${(err as Error).message}`);
        }
    }
}
