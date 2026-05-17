import { Worker as BullWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { analyticsService } from "../container";
import { Worker } from "./worker.interface";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";

export class AnalyticsWorker implements Worker {
    public name = "AnalyticsWorker";
    private worker!: BullWorker;

    start(): void {
        this.worker = new BullWorker(
            "analytics-queue",
            async (job: Job) => {
                logger.info(`[analytics-worker] Processing job: ${job.name}`);

                if (job.name === "compute-all-snapshots") {
                    await analyticsService.processAllSnapshots();
                } else if (job.name === "compute-contest-snapshot") {
                    const { contestId, organizationId } = job.data;
                    await analyticsService.generateSnapshot(contestId, organizationId);
                }
            },
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: 1, // Only one worker processing snapshots at a time is usually enough
            }
        );

        this.worker.on("completed", (job) => {
            logger.info(`[analytics-worker] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(`[analytics-worker] Job ${job?.id} failed:`, err);
        });

        // ─── Graceful shutdown ───────────────────────────────────────────────────────
        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[analytics-worker] ${signal} received — draining in-flight jobs…`);
            if (this.worker) await this.worker.close();
            logger.info(`[analytics-worker] Shutdown complete`);
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

        // Initialize the recurring job
        analyticsService.ensureRecurringJob().catch(err => {
            logger.error(`[analytics-worker] Failed to ensure recurring job:`, err);
        });
    }
}

const analyticsWorkerInstance = new AnalyticsWorker();
workerRegistry.register(analyticsWorkerInstance);
