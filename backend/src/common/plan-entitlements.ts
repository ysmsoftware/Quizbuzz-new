import { prisma } from "../config/db";
import { PlanLimitExceededError, PlanLimitType } from "../error/http-errors";

/**
 * Enforcement layer for the subscription plan limits that quizbuzz-ops-next
 * computes and syncs onto `organizations.planLimitsCache`
 * (see ops-next's EntitlementsService.syncOrgPlanLimitsCache).
 *
 * Historically that cache was only ever *read* — surfaced to the Settings →
 * "Plan & Billing" tab for display — and never consulted before letting an
 * organization create a contest, register a participant, add a question, or
 * invite a member. This module is the missing enforcement half: it re-reads
 * the same cache and gates the handful of write paths a plan is meant to cap.
 *
 * Design notes:
 *  - Fails OPEN. A missing/malformed cache, or any limit field that isn't a
 *    finite number, is treated as "unlimited" (null) rather than blocking the
 *    request. This matches the existing nullable-means-unlimited convention
 *    used throughout the Plan/OrganizationSubscription model in ops-next, and
 *    avoids locking organizations out because of a sync hiccup or an org that
 *    predates the entitlements system.
 *  - Reads are a plain `organization.findUnique` — no new tables/migrations.
 *    Per-contest and per-org limits (participants, questions, members) are
 *    checked against a live COUNT at write time. The per-cycle contest limit
 *    is checked against a COUNT of contests created within the cached
 *    `currentPeriodStart`/`currentPeriodEnd` window — no separate usage
 *    counter needed since Contest.createdAt already gives us that.
 */

export interface PlanLimits {
    maxContestsPerCycle: number | null;
    maxParticipantsPerContest: number | null;
    maxQuestionsPerContest: number | null;
    maxOrgMembers: number | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
}

const UNLIMITED: PlanLimits = {
    maxContestsPerCycle: null,
    maxParticipantsPerContest: null,
    maxQuestionsPerContest: null,
    maxOrgMembers: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
};

function toNullableNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toNullableDate(value: unknown): Date | null {
    if (typeof value !== "string") return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function parsePlanLimits(planLimitsCache: unknown): PlanLimits {
    if (!planLimitsCache || typeof planLimitsCache !== "object") {
        return { ...UNLIMITED };
    }
    const cache = planLimitsCache as Record<string, unknown>;
    return {
        maxContestsPerCycle: toNullableNumber(cache.maxContestsPerCycle),
        maxParticipantsPerContest: toNullableNumber(cache.maxParticipantsPerContest),
        maxQuestionsPerContest: toNullableNumber(cache.maxQuestionsPerContest),
        maxOrgMembers: toNullableNumber(cache.maxOrgMembers),
        currentPeriodStart: toNullableDate(cache.currentPeriodStart),
        currentPeriodEnd: toNullableDate(cache.currentPeriodEnd),
    };
}

export async function getPlanLimitsForOrg(organizationId: string): Promise<PlanLimits> {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { planLimitsCache: true },
    });
    if (!org) return { ...UNLIMITED };
    return parsePlanLimits(org.planLimitsCache);
}

/**
 * Every assert* function below returns this on a completed check (limit was
 * finite, and the request was within it — otherwise it throws) so that
 * src/middlewares/plan-limit.middleware.ts can log the real numbers on the
 * ALLOWED path too, not just on the BLOCKED one. `null` return means "no
 * check was actually performed" (limit is unlimited / not applicable) — the
 * middleware treats that as nothing worth logging.
 */
export interface PlanLimitCheckResult {
    limitType: PlanLimitType;
    limit: number;
    current: number;
}

function assertWithinLimit(
    limitType: PlanLimitType,
    limit: number,
    currentCount: number,
    increment: number,
): PlanLimitCheckResult {
    if (currentCount + increment > limit) {
        throw new PlanLimitExceededError(limitType, limit, currentCount);
    }
    return { limitType, limit, current: currentCount };
}

/**
 * Gate contest creation against `maxContestsPerCycle`.
 * Counts non-deleted contests created within the org's current billing period
 * (falls back to "all time" if the period bounds aren't cached, which can only
 * happen for an org without a synced subscription — in which case the limit
 * itself will also be null and this is a no-op).
 */
export async function assertCanCreateContest(organizationId: string): Promise<PlanLimitCheckResult | null> {
    const limits = await getPlanLimitsForOrg(organizationId);
    if (limits.maxContestsPerCycle === null) return null;

    const periodStart = limits.currentPeriodStart ?? new Date(0);
    const periodEnd = limits.currentPeriodEnd ?? new Date(8640000000000000);

    const currentCount = await prisma.contest.count({
        where: {
            organizationId,
            isDeleted: false,
            createdAt: { gte: periodStart, lte: periodEnd },
        },
    });

    return assertWithinLimit("contestsPerCycle", limits.maxContestsPerCycle, currentCount, 1);
}

/**
 * Gate the *cap an org sets* on a contest (Contest.maxParticipants) against
 * `maxParticipantsPerContest`. Called whenever that field is created/raised —
 * an org shouldn't be able to configure a per-contest seat cap above what
 * their plan allows in the first place. `current` in the returned result is
 * the requested value itself (there's no existing count here — this checks a
 * submitted number, not a live count).
 */
export async function assertParticipantCapWithinPlan(
    organizationId: string,
    requestedMax: number | null | undefined,
): Promise<PlanLimitCheckResult | null> {
    if (requestedMax === null || requestedMax === undefined) return null;
    const limits = await getPlanLimitsForOrg(organizationId);
    if (limits.maxParticipantsPerContest === null) return null;
    if (requestedMax > limits.maxParticipantsPerContest) {
        throw new PlanLimitExceededError(
            "participantsPerContest",
            limits.maxParticipantsPerContest,
            requestedMax,
        );
    }
    return { limitType: "participantsPerContest", limit: limits.maxParticipantsPerContest, current: requestedMax };
}

/**
 * Defense-in-depth gate at actual registration time against
 * `maxParticipantsPerContest`. Needed independently of
 * `assertParticipantCapWithinPlan` because a contest's own `maxParticipants`
 * field is optional (null = "no self-imposed cap") — without this, an org
 * could leave it unset and register past the plan's per-contest limit.
 */
export async function assertCanRegisterParticipant(
    organizationId: string,
    contestId: string,
): Promise<PlanLimitCheckResult | null> {
    const limits = await getPlanLimitsForOrg(organizationId);
    if (limits.maxParticipantsPerContest === null) return null;

    const currentCount = await prisma.participant.count({
        where: { organizationId, contestId },
    });

    return assertWithinLimit("participantsPerContest", limits.maxParticipantsPerContest, currentCount, 1);
}

/**
 * Gate attaching questions to a contest against `maxQuestionsPerContest`.
 * `additionalCount` is the number of question-assignment rows about to be
 * inserted (assign / bulk-assign / auto-generate) — checked as an upper bound
 * against the limit even though `skipDuplicates` may end up inserting fewer.
 */
export async function assertCanAssignQuestions(
    organizationId: string,
    contestId: string,
    additionalCount: number,
): Promise<PlanLimitCheckResult | null> {
    if (additionalCount <= 0) return null;
    const limits = await getPlanLimitsForOrg(organizationId);
    if (limits.maxQuestionsPerContest === null) return null;

    const currentCount = await prisma.contestQuestion.count({
        where: { organizationId, contestId },
    });

    return assertWithinLimit("questionsPerContest", limits.maxQuestionsPerContest, currentCount, additionalCount);
}

/**
 * Gate inviting a new org member against `maxOrgMembers`. Counts the same way
 * OrganizationRepository.countActiveOwners / findOrgMembers already do
 * (isActive: true) — which includes members with a pending (unaccepted)
 * invite, since OrgMember.isActive defaults to true at creation.
 */
export async function assertCanInviteMember(organizationId: string): Promise<PlanLimitCheckResult | null> {
    const limits = await getPlanLimitsForOrg(organizationId);
    if (limits.maxOrgMembers === null) return null;

    const currentCount = await prisma.orgMember.count({
        where: { organizationId, isActive: true },
    });

    return assertWithinLimit("orgMembers", limits.maxOrgMembers, currentCount, 1);
}
