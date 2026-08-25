/**
 * Checkpoint Drain Worker
 *
 * Responsibility:
 *   Batches per-stage job timing data out of the Redis checkpoint stream
 *   (see common/job-checkpoint.ts) into Postgres — JobCheckpoint rows plus
 *   ScheduledJob summaries — on a timer OR the moment the stream crosses its
 *   proactive memory budget, whichever comes first (see
 *   checkpointConfig.redis.softFlushEntryThreshold). Also runs the daily
 *   retention sweep for both tables (checkpointConfig.retention).
 *
 *   Deliberately shares ONE queue/worker (concurrency: 1) across both the
 *   timer-triggered and size-triggered drain requests, and the retention
 *   sweep, dispatched by job name — same job.name-dispatch pattern
 *   certificate.worker.ts already uses for real vs. test certificate jobs.
 *   concurrency: 1 means the two drain triggers can never race and
 *   double-flush the same stream entries.
 *
 * Standalone process:
 *   node dist/workers/checkpoint-drain.worker.js
 */

import { Worker as BullMQWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import {
    runCheckpointDrain,
    runCheckpointRetentionSweep,
    ensureCheckpointDrainJob,
    ensureCheckpointRetentionSweepJob,
} from "../common/checkpoint-drain";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { Worker } from "./worker.interface";

async function processCheckpointDrainJob(job: Job): Promise<void> {
    if (job.name === "sweep-checkpoint-retention") {
        const result = await runCheckpointRetentionSweep();
        logger.info(
            `[checkpoint-drain-worker] Retention sweep complete — deletedCheckpoints=${result.deletedCheckpoints} deletedJobs=${result.deletedJobs}`
        );
        return;
    }

    const result = await runCheckpointDrain();
    if (result.flushed > 0) {
        logger.info(`[checkpoint-drain-worker] Drained ${result.flushed} checkpoint entries`);
    }
}

export class CheckpointDrainWorker implements Worker {
    name = "checkpoint-drain-worker";
    private worker?: BullMQWorker;

    start() {
        this.worker = new BullMQWorker(
            "checkpoint-drain-queue",
            processCheckpointDrainJob,
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: 1, // never let timer-triggered and on-demand drains race
            }
        );

        this.worker.on("failed", (job, err) => {
            logger.error(`[checkpoint-drain-worker] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
        });

        this.worker.on("error", (err) => {
            logger.error(`[checkpoint-drain-worker] Worker error: ${err.message}`);
        });

        this.worker.on("ready", () => {
            logger.info(`[checkpoint-drain-worker] Ready — prefix: ${config.queue.prefix}`);
        });

        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[checkpoint-drain-worker] ${signal} received — draining…`);
            if (this.worker) await this.worker.close();
            logger.info("[checkpoint-drain-worker] Shutdown complete");
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

        ensureCheckpointDrainJob().catch((err) => {
            logger.error(`[checkpoint-drain-worker] Failed to schedule periodic drain: ${err.message}`);
        });
        ensureCheckpointRetentionSweepJob().catch((err) => {
            logger.error(`[checkpoint-drain-worker] Failed to schedule retention sweep: ${err.message}`);
        });
    }
}

const checkpointDrainWorkerInstance = new CheckpointDrainWorker();
workerRegistry.register(checkpointDrainWorkerInstance);
