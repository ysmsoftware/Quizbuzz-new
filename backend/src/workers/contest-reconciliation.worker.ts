/**
 * Contest Start Reconciliation Worker
 *
 * Responsibility:
 *   Periodically scan for contests whose CONTEST_START job should exist but doesn't,
 *   and re-enqueue it — via ContestService.reconcileMissingStartJobs.
 *
 * Why this exists:
 *   quiz-timer.worker.ts's isDueOrReschedule self-heal only catches a job firing at
 *   the WRONG time (e.g. after a reschedule). It has nothing to check if the job is
 *   simply absent — Redis mode-switch data loss during a go-live/go-idle switch, a
 *   failed re-schedule, an operator error. This sweep is the automatic fallback for
 *   that gap; the admin "Start Now" button (ContestService.startContestNow) is the
 *   human-triggered one. See docs/contest-start-reliability-spec.md.
 *
 * Standalone process:
 *   node dist/workers/contest-reconciliation.worker.js
 */

import { Worker as BullMQWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { contestService } from "../container";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { Worker } from "./worker.interface";

async function processContestReconciliation(job: Job): Promise<void> {
    logger.info(`[contest-reconciliation-worker] Job ${job.id} started — sweeping for missing CONTEST_START jobs`);
    const result = await contestService.reconcileMissingStartJobs();
    logger.info(`[contest-reconciliation-worker] Job ${job.id} complete — checked=${result.checked}, fixed=${result.fixed}`);
}

export class ContestReconciliationWorker implements Worker {
    name = "contest-reconciliation-worker";
    private worker?: BullMQWorker;

    start() {
        this.worker = new BullMQWorker(
            "contest-reconciliation-queue",
            processContestReconciliation,
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: 1,
            }
        );

        this.worker.on("completed", (job) => {
            logger.info(`[contest-reconciliation-worker] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(`[contest-reconciliation-worker] Job ${job?.id} failed: ${err.message}`);
        });

        this.worker.on("error", (err) => {
            logger.error(`[contest-reconciliation-worker] Worker error: ${err.message}`);
        });

        this.worker.on("ready", () => {
            logger.info(`[contest-reconciliation-worker] Ready — prefix: ${config.queue.prefix}`);
        });

        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[contest-reconciliation-worker] ${signal} received — draining…`);
            if (this.worker) await this.worker.close();
            logger.info("[contest-reconciliation-worker] Shutdown complete");
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

        contestService.ensureContestStartReconciliationJob().catch((err) => {
            logger.error(`[contest-reconciliation-worker] Failed to schedule reconciliation sweep: ${err.message}`);
        });
    }
}

const contestReconciliationWorkerInstance = new ContestReconciliationWorker();
workerRegistry.register(contestReconciliationWorkerInstance);
