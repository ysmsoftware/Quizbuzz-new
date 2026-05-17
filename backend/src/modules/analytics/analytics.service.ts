import { Prisma } from "@prisma/client";
import { AnalyticsRepository } from "./analytics.repository";
import { QuizSession } from "../quiz/quiz.session";
import { AnalyticsResponse } from "./analytics.types";
import { analyticsQueue } from "../../queues";
import { config } from "../../config";
import logger from "../../config/logger";

export class AnalyticsService {
    constructor(
        private repository: AnalyticsRepository,
        private quizSessionRepo: QuizSession
    ) {}

    /**
     * Generates a fresh snapshot for a contest and saves it to the DB.
     */
    async generateSnapshot(contestId: string, organizationId: string) {
        logger.info(`[analytics-service] Generating snapshot for contest ${contestId}`);

        const [baseMetrics, scoreMetrics, activeNow] = await Promise.all([
            this.repository.getSnapshotBaseMetrics(contestId, organizationId),
            this.repository.getAggregatedScores(contestId, organizationId),
            this.quizSessionRepo.getActiveCount(contestId)
        ]);

        const snapshotData = {
            contestId,
            organizationId,
            ...baseMetrics,
            ...scoreMetrics,
            totalRevenue: new Prisma.Decimal(baseMetrics.totalRevenue),
            activeNow,
        };

        return this.repository.upsertSnapshot(snapshotData as any);
    }

    /**
     * Gets combined analytics: latest DB snapshot + real-time Redis data.
     */
    async getContestAnalytics(contestId: string, organizationId: string): Promise<AnalyticsResponse> {
        const [snapshot, activeNow, { participatedCount, submittedCount }] = await Promise.all([
            this.repository.getSnapshot(contestId, organizationId),
            this.quizSessionRepo.getActiveCount(contestId),
            this.repository.getLiveParticipantCounts(contestId, organizationId)
        ]);

        return {
            snapshot,
            live: {
                activeNow,
                totalParticipated: participatedCount,
                totalSubmitted: submittedCount
            }
        };
    }

    /**
     * Worker entry point: process all contests that need a snapshot update.
     * We typically snapshot LIVE, EVALUATION, and recently COMPLETED contests.
     */
    async processAllSnapshots() {
        const activeContests = await this.repository.findActiveContests();
        logger.info(`[analytics-service] Running periodic snapshots for ${activeContests.length} contests`);

        for (const contest of activeContests) {
            try {
                await this.generateSnapshot(contest.id, contest.organizationId);
            } catch (error) {
                logger.error(`[analytics-service] Failed to generate snapshot for contest ${contest.id}:`, error);
            }
        }
    }

    /**
     * Ensures the recurring snapshot job is scheduled in BullMQ.
     * Called during app bootstrap.
     * Removes any existing repeatable job first to prevent duplicates on worker restart.
     */
    async ensureRecurringJob() {
        const jobId = "periodic-analytics-snapshot";
        const intervalMs = config.analytics.snapshotInterval * 60 * 1000;

        const repeatables = await analyticsQueue.getRepeatableJobs();
        const existing = repeatables.find((repeatable) => repeatable.id === jobId);
        if (existing) {
            await analyticsQueue.removeRepeatableByKey(existing.key);
        }

        // Now add the repeatable job
        await analyticsQueue.add("compute-all-snapshots", {}, {
            jobId,
            repeat: {
                every: intervalMs
            },
            removeOnComplete: true,
            removeOnFail: true
        });

        logger.info(`[analytics-service] Recurring analytics snapshot scheduled every ${config.analytics.snapshotInterval} minutes`);
    }
}
