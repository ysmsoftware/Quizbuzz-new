import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db";
import logger from "../config/logger";
import { PlanLimitExceededError } from "../error/http-errors";
import {
    PlanLimitCheckResult,
    assertCanCreateContest,
    assertParticipantCapWithinPlan,
    assertCanRegisterParticipant,
    assertCanAssignQuestions,
    assertCanInviteMember,
} from "../common/plan-entitlements";

/**
 * The API-gate half of plan enforcement. `src/common/plan-entitlements.ts`
 * has the actual limit math (shared, single source of truth); this file's
 * only job is to run those checks as Express middleware — ahead of the
 * controller, on the route itself — and persist a `PlanUsageCheckLog` row
 * for every check, allowed or blocked, so the ops dashboard can see it.
 *
 * A `PlanLimitExceededError` thrown by any check below flows to `next(err)`
 * and is handled by the existing `error.middleware.ts` branch, which already
 * returns the structured `PLAN_LIMIT_EXCEEDED` response shape — nothing
 * about the response format changes by moving the check here.
 */

async function recordCheck(
    organizationId: string,
    outcome: "ALLOWED" | "BLOCKED",
    result: { limitType: string; limit: number | null; current: number },
    requestId?: string,
): Promise<void> {
    try {
        await prisma.planUsageCheckLog.create({
            data: {
                organizationId,
                limitType: result.limitType,
                outcome,
                limitValue: result.limit,
                currentValue: result.current,
                requestId: requestId ?? null,
            },
        });
    } catch (err) {
        // Audit logging must never be the reason a real request fails.
        logger.error(`[plan-limit] failed to write PlanUsageCheckLog: ${(err as Error).message}`);
    }
}

/**
 * Runs `check()`, logs the outcome (skipping the log entirely when `check()`
 * returns null — meaning the limit is unlimited / not applicable, so there's
 * nothing meaningful to record), and forwards a `PlanLimitExceededError` to
 * the error middleware if the limit was exceeded.
 */
async function runCheck(
    req: Request,
    res: Response,
    next: NextFunction,
    organizationId: string | undefined,
    check: () => Promise<PlanLimitCheckResult | null>,
): Promise<void> {
    if (!organizationId) {
        // No org context (shouldn't happen behind authenticatedOrgMiddleware,
        // but for public routes resolving org from a slug it's a valid "not
        // found yet" state) — let the controller's own lookup 404 it.
        next();
        return;
    }

    const requestId = (req as any).id as string | undefined;

    try {
        const result = await check();
        if (result) {
            await recordCheck(organizationId, "ALLOWED", result, requestId);
        }
        next();
    } catch (err) {
        if (err instanceof PlanLimitExceededError) {
            await recordCheck(
                organizationId,
                "BLOCKED",
                { limitType: err.limitType, limit: err.limit, current: err.current },
                requestId,
            );
        }
        next(err);
    }
}

/** Mount on: POST /contests (create). */
export function enforceContestCreateLimits(req: Request, res: Response, next: NextFunction): void {
    const organizationId = req.user?.organizationId;
    void runCheck(req, res, next, organizationId, async () => {
        // Two independent checks share this one middleware slot: the
        // contests-per-cycle ceiling, and (if the org is setting a per-contest
        // participant cap on this new contest) that cap against the plan.
        // Only the first non-null result gets logged — see the comment on
        // runCheck; if you need both logged independently, split this back
        // into two middleware calls on the route.
        const cycleResult = await assertCanCreateContest(organizationId!);
        const capResult = await assertParticipantCapWithinPlan(organizationId!, req.body?.maxParticipants);
        return cycleResult ?? capResult;
    });
}

/** Mount on: PATCH /contests/:contestId (update) — only relevant when maxParticipants is in the body. */
export function enforceContestUpdateParticipantCap(req: Request, res: Response, next: NextFunction): void {
    const organizationId = req.user?.organizationId;
    void runCheck(req, res, next, organizationId, () =>
        assertParticipantCapWithinPlan(organizationId!, req.body?.maxParticipants),
    );
}

/** Mount on: POST /contests/register/:contestSlug (public — no authenticatedOrgMiddleware). */
export function enforceParticipantRegistrationLimit(req: Request, res: Response, next: NextFunction): void {
    void (async () => {
        const { contestRepository } = require("../container");
        const contestSlug = req.params.contestSlug as string;
        const contest = contestSlug ? await contestRepository.findBySlugPublic(contestSlug) : null;

        // Contest not found / slug typo'd — not our concern, let the normal
        // registration flow 404 it with its own message.
        await runCheck(req, res, next, contest?.organizationId, () =>
            assertCanRegisterParticipant(contest.organizationId, contest.id),
        );
    })();
}

/** Mount on: POST /questions/contests/:contestId/assign-questions. */
export function enforceQuestionAssignLimit(req: Request, res: Response, next: NextFunction): void {
    const organizationId = req.user?.organizationId;
    const contestId = req.params.contestId as string;
    const additionalCount = Array.isArray(req.body?.questions) ? req.body.questions.length : 0;
    void runCheck(req, res, next, organizationId, () =>
        assertCanAssignQuestions(organizationId!, contestId, additionalCount),
    );
}

/**
 * Mount on: POST /questions/contests/:contestId/auto-generate.
 * `totalQuestions` is the requested count up front — the actual candidate-
 * matching algorithm may select fewer, but this is checked as the upper
 * bound the request is asking for, same conservative approach as the
 * assign-questions check above.
 */
export function enforceQuestionAutoGenerateLimit(req: Request, res: Response, next: NextFunction): void {
    const organizationId = req.user?.organizationId;
    const contestId = req.params.contestId as string;
    const additionalCount = typeof req.body?.totalQuestions === "number" ? req.body.totalQuestions : 0;
    void runCheck(req, res, next, organizationId, () =>
        assertCanAssignQuestions(organizationId!, contestId, additionalCount),
    );
}

/**
 * Mount on: POST /organizations/:orgId/members/invite.
 * Mirrors the "reissuing a token for an existing pending invite doesn't
 * create a new member" exemption that lives in OrganizationService.inviteMember
 * — replicated here (rather than skipped) so the gate is accurate: without
 * it, every reissue would be checked against the limit as if it were a new
 * member, which it isn't.
 */
export function enforceOrgMemberInviteLimit(req: Request, res: Response, next: NextFunction): void {
    void (async () => {
        const organizationId = req.params.orgId as string;
        const email = req.body?.email as string | undefined;

        if (!organizationId || !email) {
            next();
            return;
        }

        const { adminAuthRepository, organizationRepository } = require("../container");
        const targetAdmin = await adminAuthRepository.findByEmail(email);
        if (!targetAdmin) {
            // No account with that email — the service will 404 this itself.
            next();
            return;
        }

        const existingMembership = await organizationRepository.findPendingMembership(targetAdmin.id, organizationId);
        if (existingMembership) {
            // Reissuing a token for an existing (pending or active) membership
            // adds no new member — nothing to check against maxOrgMembers.
            next();
            return;
        }

        await runCheck(req, res, next, organizationId, () => assertCanInviteMember(organizationId));
    })();
}
