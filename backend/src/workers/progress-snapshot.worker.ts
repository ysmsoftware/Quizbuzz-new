/**
 * Progress Snapshot Worker
 *
 * Responsibility:
 *   Periodically snapshot every live-contest participant's in-progress Redis
 *   state into participant_progress_snapshots (Phase 1 of the durability spec),
 *   so a Redis wipe loses at most one snapshot interval instead of everything
 *   since join. See DurabilityService.
 *
 * Standalone process:
 *   node dist/workers/progress-snapshot.worker.js
 */

import { Worker as BullMQWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { durabilityService } from "../container";
import { Worker } from "./worker.interface";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";

export class ProgressSnapshotWorker implements Worker {
    name = "progress-snapshot-worker";
    private worker?: BullMQWorker;

    start(): void {
        this.worker = new BullMQWorker(
            "progress-snapshot-queue",
            async (job: Job) => {
                if (job.name === "snapshot-all-live-contests") {
                    const result = await durabilityService.snapshotAllLiveContests();
                    logger.info(`[progress-snapshot-worker] Swept ${result.contestsSwept} contests, ${result.participantsSnapshotted} participants`);
                }
            },
            {
                connection: redis,
                prefix: config.queue.prefix,
                // Must never overlap — a second concurrent run would double-batch
                // the same participants and waste DB writes for no benefit.
                concurrency: 1,
            }
        );

        this.worker.on("completed", (job) => {
            logger.info(`[progress-snapshot-worker] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(`[progress-snapshot-worker] Job ${job?.id} failed: ${err.message}`);
        });

        this.worker.on("error", (err) => {
            logger.error(`[progress-snapshot-worker] Worker error: ${err.message}`);
        });

        this.worker.on("ready", () => {
            logger.info(`[progress-snapshot-worker] Ready — prefix: ${config.queue.prefix}`);
        });

        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[progress-snapshot-worker] ${signal} received — draining in-flight jobs…`);
            if (this.worker) await this.worker.close();
            logger.info(`[progress-snapshot-worker] Shutdown complete`);
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

        durabilityService.ensureRecurringJob().catch(err => {
            logger.error(`[progress-snapshot-worker] Failed to ensure recurring job:`, err);
        });
    }
}

const progressSnapshotWorkerInstance = new ProgressSnapshotWorker();
workerRegistry.register(progressSnapshotWorkerInstance);
