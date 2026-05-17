import { prisma } from "../../config/db";
import { Prisma } from "@prisma/client";

interface ScoredRow {
    participantId: string;
    score: Prisma.Decimal;
    percentage: Prisma.Decimal;
    timeTakenSecs: number | null;
}

export class LeaderboardRepository {

    /**
     * Read all evaluated submissions for a contest in one query.
     * Called by the leaderboard builder — this is the only DB read in the whole pipeline.
     */
    async fetchEvaluatedScores(
        contestId: string,
        organizationId: string,
    ): Promise<ScoredRow[]> {
        return prisma.submission.findMany({
            where: { contestId, organizationId, status: "EVALUATED" },
            select: {
                participantId: true,
                score: true,
                percentage: true,
                timeTakenSecs: true,
            },
        }) as unknown as Promise<ScoredRow[]>;
    }

    /**
     * Bulk-insert ranked leaderboard entries in a single transaction.
     * Called once after sorting — no per-row writes, no window functions.
     *
     * Uses deleteMany + createMany so the operation is idempotent:
     * if the builder job is retried, it wipes the previous attempt
     * and writes fresh ranks rather than hitting a unique-constraint error.
     */
    async buildLeaderboard(
        contestId: string,
        organizationId: string,
        ranked: Array<ScoredRow & { rank: number }>,
    ): Promise<void> {
        await prisma.$transaction([
            // Wipe any previous partial build (idempotency)
            prisma.leaderboardEntry.deleteMany({ where: { contestId, organizationId } }),

            // Single bulk insert — one round trip
            prisma.leaderboardEntry.createMany({
                data: ranked.map((r) => ({
                    organizationId,
                    contestId,
                    participantId: r.participantId,
                    score: r.score,
                    percentage: r.percentage,
                    timeTakenSecs: r.timeTakenSecs ?? 0,
                    rank: r.rank,
                    isPublished: false,
                })),
            }),
        ]);
    }

    /**
     * Assign prize brackets after ranks are set.
     * Called from declareResults (or a dedicated admin action).
     */
    async assignPrizes(
        contestId: string,
        prizes: Array<{ id: string; rankFrom: number; rankTo: number }>,
    ): Promise<void> {
        for (const prize of prizes) {
            await prisma.leaderboardEntry.updateMany({
                where: { contestId, rank: { gte: prize.rankFrom, lte: prize.rankTo } },
                data: { prizeId: prize.id },
            });
        }
    }

    async publishAll(contestId: string, organizationId: string) {
        return prisma.leaderboardEntry.updateMany({
            where: { contestId, organizationId },
            data: { isPublished: true },
        });
    }

    async countEntries(contestId: string, organizationId: string): Promise<number> {
        return prisma.leaderboardEntry.count({ where: { contestId, organizationId } });
    }

    async findAll(contestId: string, organizationId: string, page: number, limit: number) {
        const skip = (page - 1) * limit;
        const [entries, total] = await prisma.$transaction([
            prisma.leaderboardEntry.findMany({
                where: { contestId, organizationId, isPublished: true },
                skip,
                take: limit,
                orderBy: { rank: "asc" },
                include: {
                    participant: {
                        include: { contact: { select: { firstName: true, lastName: true } } },
                    },
                },
            }),
            prisma.leaderboardEntry.count({ where: { contestId, organizationId, isPublished: true } }),
        ]);
        return { entries, total };
    }
}