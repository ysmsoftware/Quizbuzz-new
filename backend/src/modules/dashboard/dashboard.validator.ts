import { z } from "zod";
import { ContestStatus, ParticipantStatus } from "@prisma/client";
import { config } from "../../config";

/**
 * All limits/defaults are pulled from config.dashboard (env-driven) — nothing here
 * is a hardcoded response size. Query params always win; the config values are only
 * the fallback + the upper bound.
 */

// GET /:orgId/dashboard/overview

export const OverviewQuerySchema = z.object({
    period: z.enum(["week", "month"]).default(config.dashboard.defaultPeriod),
});

// GET /:orgId/dashboard/upcoming-contests

const DEFAULT_UPCOMING_STATUSES = [
    ContestStatus.PUBLISHED,
    ContestStatus.REGISTRATION_CLOSED,
    ContestStatus.LIVE,
];

// Accepts either a single value (?status=LIVE) or a comma-separated list
// (?status=LIVE,PUBLISHED) — Express query parsing gives us a string either way.
const statusListSchema = z
    .union([z.nativeEnum(ContestStatus), z.string()])
    .transform((val) => {
        const raw = Array.isArray(val) ? val : String(val).split(",");
        return raw.map((s) => s.trim()).filter(Boolean) as ContestStatus[];
    })
    .refine((arr) => arr.every((s) => Object.values(ContestStatus).includes(s)), {
        message: "Invalid contest status filter",
    })
    .optional();

export const UpcomingContestsQuerySchema = z.object({
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(config.dashboard.upcomingContests.maxLimit)
        .default(config.dashboard.upcomingContests.defaultLimit),
    status: statusListSchema,
    sortBy: z.enum(["startTime", "registrationDeadline", "createdAt"]).default("startTime"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
}).transform((q) => ({
    limit: q.limit,
    statuses: q.status && q.status.length > 0 ? q.status : DEFAULT_UPCOMING_STATUSES,
    sortBy: q.sortBy,
    sortOrder: q.sortOrder,
}));

// GET /:orgId/dashboard/recent-registrations

export const RecentRegistrationsQuerySchema = z.object({
    limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(config.dashboard.recentRegistrations.maxLimit)
        .default(config.dashboard.recentRegistrations.defaultLimit),
    page: z.coerce.number().int().min(1).default(1),
    sortBy: z.enum(["createdAt", "status"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    contestId: z.string().min(1).optional(),
    status: z.nativeEnum(ParticipantStatus).optional(),
});

// GET /:orgId/dashboard/registration-trend

export const RegistrationTrendQuerySchema = z.object({
    days: z.coerce
        .number()
        .int()
        .min(1)
        .max(config.dashboard.trend.maxDays)
        .default(config.dashboard.trend.defaultDays),
});

// GET /:orgId/dashboard/contests-by-status

export const ContestsByStatusQuerySchema = z.object({
    includeArchived: z.preprocess(
        (val) => {
            if (typeof val === "string") {
                if (val.toLowerCase() === "true" || val === "1") return true;
                if (val.toLowerCase() === "false" || val === "0" || val === "") return false;
            }
            return val;
        },
        z.boolean()
    ).default(false),
});

export type OverviewQueryInput = z.infer<typeof OverviewQuerySchema>;
export type UpcomingContestsQueryInput = z.infer<typeof UpcomingContestsQuerySchema>;
export type RecentRegistrationsQueryInput = z.infer<typeof RecentRegistrationsQuerySchema>;
export type RegistrationTrendQueryInput = z.infer<typeof RegistrationTrendQuerySchema>;
export type ContestsByStatusQueryInput = z.infer<typeof ContestsByStatusQuerySchema>;
