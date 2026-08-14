/**
 * Audit Retention Sweep Worker
 *
 * Responsibility:
 *   Daily sweep that hard-deletes audit_logs rows older than
 *   auditLogConfig.retention.maxAgeDays (see common/audit-retention.ts).
 *
 * Standalone process:
 *   node dist/workers/audit-retention-sweep.worker.js
 */

import { Worker as BullMQWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { runAuditRetentionSweep, ensureAuditRetentionSweepJob } from "../common/audit-retention";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { Worker } from "./worker.interface";

async function processAuditRetentionSweep(job: Job): Promise<void> {
    logger.info(`[audit-retention-sweep-worker] Job ${job.id} started`);
    const result = await runAuditRetentionSweep();
    logger.info(`[audit-retention-sweep-worker] Job ${job.id} complete — deleted=${result.deleted}`);
}

export class AuditRetentionSweepWorker implements Worker {
    name = "audit-retention-sweep-worker";
    private worker?: BullMQWorker;

    start() {
        this.worker = new BullMQWorker(
            "audit-retention-queue",
            processAuditRetentionSweep,
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: 1,
            }
        );

        this.worker.on("completed", (job) => {
            logger.info(`[audit-retention-sweep-worker] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(`[audit-retention-sweep-worker] Job ${job?.id} failed: ${err.message}`);
        });

        this.worker.on("error", (err) => {
            logger.error(`[audit-retention-sweep-worker] Worker error: ${err.message}`);
        });

        this.worker.on("ready", () => {
            logger.info(`[audit-retention-sweep-worker] Ready — prefix: ${config.queue.prefix}`);
        });

        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[audit-retention-sweep-worker] ${signal} received — draining…`);
            if (this.worker) await this.worker.close();
            logger.info("[audit-retention-sweep-worker] Shutdown complete");
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

        ensureAuditRetentionSweepJob().catch((err) => {
            logger.error(`[audit-retention-sweep-worker] Failed to schedule sweep: ${err.message}`);
        });
    }
}

const auditRetentionSweepWorkerInstance = new AuditRetentionSweepWorker();
workerRegistry.register(auditRetentionSweepWorkerInstance);
