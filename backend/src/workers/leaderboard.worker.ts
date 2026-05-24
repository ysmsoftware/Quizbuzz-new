/**
 * Leaderboard Worker
 *
 * Responsibility: once all submissions for a contest are evaluated, read all
 * scored submissions, sort in memory (O(N log N), pure JS), and bulk-insert
 * ranked LeaderboardEntry rows in a single transaction.
 *
 * Triggered by: evaluation.worker (when its Redis counter reaches totalSubmitted)
 * Triggered also by: admin manual re-rank if needed
 * Cost regardless of N: 1 DB read + 1 JS sort + 1 bulk insert.
 */

import { Worker as BullMQWorker, Job, UnrecoverableError } from "bullmq";
import { Prisma } from "@prisma/client";
import { redis } from "../config/redis";
import { config } from "../config";
import { leaderboardRepository } from "../container";
import { LeaderboardBuildPayload } from "../queues";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { Worker } from "./worker.interface";

// ─── Pure ranking function — no I/O ──────────────────────────────────────────

interface ScoredRow {
    participantId: string;
    score: Prisma.Decimal;
    percentage: Prisma.Decimal;
    isPassed: boolean | null;
    timeTakenSecs: number | null;
}

/**
 * Sorts rows by score DESC, then timeTakenSecs ASC (faster = higher rank on tie).
 * Returns the same rows with a 1-based rank field attached.
 * Pure function — fully unit-testable with no mocking.
 */
export function rankRows(
    rows: ScoredRow[],
): Array<ScoredRow & { rank: number }> {
    const sorted = [...rows].sort((a, b) => {
        // Primary: score descending
        const scoreDiff = new Prisma.Decimal(b.score).minus(a.score).toNumber();
        if (scoreDiff !== 0) return scoreDiff > 0 ? 1 : -1;

        // Tiebreaker: time ascending (faster = better)
        const aTime = a.timeTakenSecs ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.timeTakenSecs ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
    });

    return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

// ─── Worker processor ─────────────────────────────────────────────────────────

async function buildLeaderboard(job: Job<LeaderboardBuildPayload>): Promise<void> {
    const { contestId, organizationId } = job.data;

    logger.info(`[leaderboard-worker] Building leaderboard for contest ${contestId}`);

    if (!contestId || !organizationId) {
        throw new UnrecoverableError(
            `[leaderboard-worker] Missing contestId or organizationId in payload`
        );
    }
    await job.updateProgress(10);

    // ── Step 1: Fetch all evaluated scores (one query) ────────────────────────
    const scores = await leaderboardRepository.fetchEvaluatedScores(contestId, organizationId);

    if (scores.length === 0) {
        logger.warn(
            `[leaderboard-worker] No evaluated submissions for contest ${contestId} — skipping`
        );
        await job.updateProgress(100);
        return;
    }

    logger.info(
        `[leaderboard-worker] Fetched ${scores.length} scores for contest ${contestId}`
    );
    await job.updateProgress(40);

    // ── Step 2: Sort in memory (pure JS — O(N log N), no DB) ─────────────────
    const ranked = rankRows(scores);

    logger.info(
        `[leaderboard-worker] Sorted ${ranked.length} entries — top score: ${ranked[0]?.score}`
    );
    await job.updateProgress(70);

    // ── Step 3: Bulk insert in one transaction ────────────────────────────────
    await leaderboardRepository.buildLeaderboard(contestId, organizationId, ranked);

    // ── Step 4: Clean up the Redis eval counter ───────────────────────────────
    await redis.del(`leaderboard:eval-counter:${contestId}`);

    logger.info(
        `[leaderboard-worker] Leaderboard built for contest ${contestId}: ${ranked.length} entries`
    );
    await job.updateProgress(100);
}

// ─── Worker registration ──────────────────────────────────────────────────────

export class LeaderboardWorker implements Worker {
    name = "leaderboard-worker";
    private worker?: BullMQWorker<LeaderboardBuildPayload>;

    start() {
        this.worker = new BullMQWorker<LeaderboardBuildPayload>(
            "leaderboard-queue",
            buildLeaderboard,
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: 2, // leaderboard builds are infrequent and memory-light
            }
        );

        this.worker.on("completed", (job) => {
            logger.info(`[leaderboard-worker] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(
                `[leaderboard-worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`
            );
        });

        this.worker.on("error", (err) => {
            logger.error(`[leaderboard-worker] Worker error: ${err.message}`);
        });

        const shutdown = async (signal: string) => {
            logger.info(`[leaderboard-worker] ${signal} — draining…`);
            await this.worker?.close();
            process.exit(0);
        };
        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    }
}

const leaderboardWorkerInstance = new LeaderboardWorker();
workerRegistry.register(leaderboardWorkerInstance);