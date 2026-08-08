import { prisma } from "../config/db";
import { getPlanLimitsForOrg, PlanLimits } from "./plan-entitlements";

/**
 * Read-only reporting: "how much of the plan has this org used right now."
 * Deliberately separate from plan-entitlements.ts, which answers a
 * different question ("is this one write allowed") — that file gates
 * requests, this one just describes current state for display (the
 * Settings → Plan & Billing usage bars).
 */
export interface PlanUsageSummary {
    contestsUsedThisCycle: number;
    /** Per-contest ceiling, not an org-wide total — the org's single fullest contest is what matters. */
    maxParticipantsInAContest: number;
    maxQuestionsInAContest: number;
    memberCountUsed: number;
    limits: PlanLimits;
}

export async function getPlanUsageSummary(organizationId: string): Promise<PlanUsageSummary> {
    const limits = await getPlanLimitsForOrg(organizationId);
    const periodStart = limits.currentPeriodStart ?? new Date(0);
    const periodEnd = limits.currentPeriodEnd ?? new Date(8640000000000000);

    const [contestsUsedThisCycle, participantCounts, questionCounts, memberCountUsed] = await Promise.all([
        prisma.contest.count({
            where: { organizationId, isDeleted: false, createdAt: { gte: periodStart, lte: periodEnd } },
        }),
        prisma.participant.groupBy({
            by: ["contestId"],
            where: { organizationId },
            _count: { _all: true },
        }),
        prisma.contestQuestion.groupBy({
            by: ["contestId"],
            where: { organizationId },
            _count: { _all: true },
        }),
        prisma.orgMember.count({ where: { organizationId, isActive: true } }),
    ]);

    const maxParticipantsInAContest = participantCounts.reduce((max, row) => Math.max(max, row._count._all), 0);
    const maxQuestionsInAContest = questionCounts.reduce((max, row) => Math.max(max, row._count._all), 0);

    return {
        contestsUsedThisCycle,
        maxParticipantsInAContest,
        maxQuestionsInAContest,
        memberCountUsed,
        limits,
    };
}
