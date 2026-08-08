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

    /**
     * @param cutoffScore Contest.cutoffScore (percentage pass mark). When null/undefined
     *   the contest has no configured pass mark, so passingCount/failingCount are
     *   returned as null rather than asserting a split that was never defined.
     */
    async getAggregatedScores(contestId: string, organizationId: string, cutoffScore?: number | null) {
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
                timeTakenSecs: true,
            },
            _min: {
                score: true,
                timeTakenSecs: true,
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

        let passingCount: number | null = null;
        let failingCount: number | null = null;
        if (cutoffScore !== null && cutoffScore !== undefined) {
            [passingCount, failingCount] = await Promise.all([
                this.prisma.submission.count({
                    where: { contestId, organizationId, status: "EVALUATED", percentage: { gte: cutoffScore } },
                }),
                this.prisma.submission.count({
                    where: { contestId, organizationId, status: "EVALUATED", percentage: { lt: cutoffScore } },
                }),
            ]);
        }

        return {
            avgScore: stats._avg.score ? Number(stats._avg.score) : null,
            highestScore: stats._max.score ? Number(stats._max.score) : null,
            lowestScore: stats._min.score ? Number(stats._min.score) : null,
            medianScore: medianResult[0]?.median ? Number(medianResult[0].median) : null,
            avgTimeTakenSecs: stats._avg.timeTakenSecs ? Math.round(Number(stats._avg.timeTakenSecs)) : null,
            fastestTimeSecs: stats._min.timeTakenSecs ?? null,
            slowestTimeSecs: stats._max.timeTakenSecs ?? null,
            passingCount,
            failingCount,
        };
    }

    /**
     * Contest's configured pass mark (percentage), used to compute
     * passingCount/failingCount in getAggregatedScores. Null = contest has
     * no pass mark configured.
     */
    async getContestCutoffScore(contestId: string): Promise<number | null> {
        const contest = await this.prisma.contest.findUnique({
            where: { id: contestId },
            select: { cutoffScore: true },
        });
        return contest?.cutoffScore ?? null;
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
