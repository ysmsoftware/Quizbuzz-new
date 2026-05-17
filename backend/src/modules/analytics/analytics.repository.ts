import { PrismaClient, ContestAnalyticsSnapshot, ContestStatus } from "@prisma/client";
import { ScoreDistributionEntry } from "./analytics.types";

export class AnalyticsRepository {
    constructor(private prisma: PrismaClient) {}

    async getScoreDistribution(contestId: string): Promise<ScoreDistributionEntry[]> {
        const result = await this.prisma.submission.groupBy({
            by: ["score"],
            where: {
                contestId,
                status: "EVALUATED",
            },
            _count: {
                id: true,
            },
            orderBy: {
                score: "asc",
            },
        });

        return result.map((r) => ({
            score: Number(r.score || 0),
            count: r._count.id,
        }));
    }

    async getSnapshotBaseMetrics(contestId: string, organizationId: string) {
        const [registrations, revenueData, participated, submitted] = await Promise.all([
            // Total Registrations
            this.prisma.participant.count({
                where: { contestId, organizationId },
            }),
            // Total Revenue
            this.prisma.payment.aggregate({
                where: { contestId, organizationId, status: "SUCCESS" },
                _sum: { amount: true },
            }),
            // Total Participated (started the quiz)
            this.prisma.participant.count({
                where: {
                    contestId,
                    organizationId,
                    joinedAt: { not: null },
                },
            }),
            // Total Submitted
            this.prisma.submission.count({
                where: {
                    contestId,
                    organizationId,
                    status: { in: ["SUBMITTED", "EVALUATED"] },
                },
            }),
        ]);

        return {
            totalRegistrations: registrations,
            totalRevenue: Number(revenueData._sum.amount || 0) / 100, // convert paise to main unit
            totalParticipated: participated,
            totalSubmitted: submitted,
        };
    }

    async getAggregatedScores(contestId: string, organizationId: string) {
        const stats = await this.prisma.submission.aggregate({
            where: {
                contestId,
                organizationId,
                status: "EVALUATED",
            },
            _avg: {
                score: true,
                timeTakenSecs: true,
            },
            _max: {
                score: true,
            },
            _min: {
                score: true,
            },
        });

        // Median is not available in Prisma aggregate, use raw query for Postgres
        const medianResult = await this.prisma.$queryRaw<Array<{ median: number }>>`
            SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score::float) as median
            FROM submissions
            WHERE "contestId" = ${contestId}
              AND "organizationId" = ${organizationId}
              AND status = 'EVALUATED'
        `;

        return {
            avgScore: stats._avg.score ? Number(stats._avg.score) : null,
            highestScore: stats._max.score ? Number(stats._max.score) : null,
            lowestScore: stats._min.score ? Number(stats._min.score) : null,
            medianScore: medianResult[0]?.median ? Number(medianResult[0].median) : null,
            avgTimeTakenSecs: stats._avg.timeTakenSecs ? Math.round(Number(stats._avg.timeTakenSecs)) : null,
        };
    }

    async upsertSnapshot(data: Partial<ContestAnalyticsSnapshot> & { contestId: string, organizationId: string }) {
        return this.prisma.contestAnalyticsSnapshot.upsert({
            where: { contestId: data.contestId },
            update: {
                ...data,
                snapshotAt: new Date(),
            },
            create: {
                ...data as any,
                snapshotAt: new Date(),
            },
        });
    }

    async getSnapshot(contestId: string, organizationId: string): Promise<ContestAnalyticsSnapshot | null> {
        return this.prisma.contestAnalyticsSnapshot.findUnique({
            where: { contestId },
        });
    }

    /**
     * Get live participant and submission counts for a specific contest.
     * Used in getContestAnalytics() to supplement snapshot data with real-time counts.
     */
    async getLiveParticipantCounts(contestId: string, organizationId: string) {
        const [participatedCount, submittedCount] = await Promise.all([
            this.prisma.participant.count({
                where: { contestId, organizationId, joinedAt: { not: null } }
            }),
            this.prisma.submission.count({
                where: { contestId, organizationId, status: { in: ["SUBMITTED", "EVALUATED"] } }
            })
        ]);

        return { participatedCount, submittedCount };
    }

    /**
     * Find all active contests that need analytics snapshots.
     * Used by processAllSnapshots() to iterate over contests requiring updates.
     */
    async findActiveContests() {
        return this.prisma.contest.findMany({
            where: {
                status: {
                    in: [ContestStatus.LIVE, ContestStatus.EVALUATION, ContestStatus.RESULTS_OUT]
                },
                isDeleted: false
            },
            select: { id: true, organizationId: true }
        });
    }
}
