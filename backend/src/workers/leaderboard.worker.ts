/**
 * Leaderboard Worker
 *
 * Responsibility: once all submissions for a contest are evaluated, read all
 * scored submissions, sort in memory (O(N log N), pure JS), and bulk-insert
 * ranked LeaderboardEntry rows in a single transaction.
 *
 * Triggered by: evaluation.worker, debounced after every completed evaluation
 *               (see evaluation.worker.ts's scheduleLeaderboardRebuild — it no
 *               longer tries to detect "the last one", it just fires this,
 *               debounced, after each evaluation and lets this always-fresh
 *               recompute be the source of truth)
 * Triggered also by: admin manual re-rank if needed
 * Cost regardless of N: 1 DB read + 1 JS sort + 1 bulk insert.
 */

import { Worker as BullMQWorker, Job, UnrecoverableError } from "bullmq";
import { Prisma } from "@prisma/client";
import { redis } from "../config/redis";
import { config } from "../config";
import { LeaderboardBuildPayload } from "../queues";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { Worker } from "./worker.interface";
import { withCheckpoint, recordJobBoundary, CheckpointMeta } from "../common/job-checkpoint";

// ─── Pure ranking function — no I/O ──────────────────────────────────────────

interface ScoredRow {
    participantId: string;
    score: Prisma.Decimal;
    percentage: Prisma.Decimal;
    isPassed: boolean | null;
    timeTakenSecs: number | null;
    timeTakenMs: number | null;
}

export function rankRows(
    rows: ScoredRow[],
): Array<ScoredRow & { rank: number }> {
    const sorted = [...rows].sort((a, b) => {
        const scoreDiff = new Prisma.Decimal(b.score).minus(a.score).toNumber();
        if (scoreDiff !== 0) return scoreDiff > 0 ? 1 : -1;

        const aTime = a.timeTakenMs ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.timeTakenMs ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
    });

    return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

// ─── Worker processor ─────────────────────────────────────────────────────────

async function buildLeaderboard(job: Job<LeaderboardBuildPayload>): Promise<void> {
    const { contestId, organizationId } = job.data;
    const { leaderboardRepository } = require("../container");

    logger.info(`[leaderboard-worker] Building leaderboard for contest ${contestId}`);

    if (!contestId || !organizationId) {
        throw new UnrecoverableError(
            `[leaderboard-worker] Missing contestId or organizationId in payload`
        );
    }
    await job.updateProgress(10);

    // Checkpoint identity for this job — see common/job-checkpoint.ts. Only
    // recorded to Redis, batched into Postgres by checkpoint-drain.worker.ts —
    // never a synchronous write on this hot path. Mirrors evaluation.worker.ts's
    // pattern (this job is itself debounced-triggered by that worker).
    const checkpointMeta: CheckpointMeta = {
        jobId: job.id ?? contestId,
        queue: "leaderboard-queue",
        organizationId,
        contestId,
        entityType: "CONTEST",
        entityId: contestId,
    };
    if (job.attemptsMade === 0) {
        recordJobBoundary(checkpointMeta, "STARTED", undefined, job.timestamp);
    }

    // ── Step 1: Fetch all evaluated scores (one query) ────────────────────────
    const scores = await withCheckpoint<ScoredRow[]>(checkpointMeta, "fetch_scores", () =>
        leaderboardRepository.fetchEvaluatedScores(contestId, organizationId)
    );

    if (scores.length === 0) {
        logger.warn(
            `[leaderboard-worker] No evaluated submissions for contest ${contestId} — skipping`
        );
        await job.updateProgress(100);
        recordJobBoundary(checkpointMeta, "COMPLETED");
        return;
    }

    logger.info(
        `[leaderboard-worker] Fetched ${scores.length} scores for contest ${contestId}`
    );
    await job.updateProgress(40);

    // ── Step 2: Sort in memory (pure JS — O(N log N), no DB) ─────────────────
    const ranked = await withCheckpoint(checkpointMeta, "sort_rankings", async () => rankRows(scores));

    logger.info(
        `[leaderboard-worker] Sorted ${ranked.length} entries — top score: ${ranked[0]?.score}`
    );
    await job.updateProgress(70);

    // ── Step 3: Bulk insert in one transaction ────────────────────────────────
    await withCheckpoint(checkpointMeta, "persist_leaderboard", () =>
        leaderboardRepository.buildLeaderboard(contestId, organizationId, ranked)
    );

    logger.info(
        `[leaderboard-worker] Leaderboard built for contest ${contestId}: ${ranked.length} entries`
    );
    await job.updateProgress(100);
    recordJobBoundary(checkpointMeta, "COMPLETED");
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

            if (job?.data?.contestId && job.data.organizationId) {
                recordJobBoundary(
                    {
                        jobId: job.id ?? job.data.contestId,
                        queue: "leaderboard-queue",
                        organizationId: job.data.organizationId,
                        contestId: job.data.contestId,
                        entityType: "CONTEST",
                        entityId: job.data.contestId,
                    },
                    "FAILED",
                    err.message
                );
            }
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