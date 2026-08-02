/**
 * Payment Cleanup Worker
 *
 * Responsibility:
 *   Periodically close out abandoned payments — still PENDING/CREATED with no
 *   activity in config.payment.abandonedCloseAfterMs (default 24h) — to FAILED,
 *   via PaymentService.closeAbandonedPayments.
 *
 * Why this exists:
 *   The resume-or-fresh flow (PaymentService.createOrder) already handles anyone
 *   who actively comes back to retry, refreshing their order in place. But someone
 *   who registers, abandons checkout, and never returns at all leaves a Payment
 *   row sitting at PENDING indefinitely — which shows up as a perpetually
 *   ambiguous "Pending" entry in the org's registration list. This sweep is what
 *   eventually resolves that to a definitive FAILED, without ever touching or
 *   blocking a live retry (24h is a wide safety margin past the 10-minute reuse
 *   window used for active retries, and Razorpay webhooks land in seconds to low
 *   minutes even on retry, so nothing legitimate is still "in flight" that long).
 *
 * Standalone process:
 *   node dist/workers/payment-cleanup.worker.js
 */

import { Worker as BullMQWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { paymentService } from "../container";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { Worker } from "./worker.interface";

async function processPaymentCleanup(job: Job): Promise<void> {
    logger.info(`[payment-cleanup-worker] Job ${job.id} started — sweeping abandoned payments`);
    const result = await paymentService.closeAbandonedPayments();
    logger.info(`[payment-cleanup-worker] Job ${job.id} complete — closed=${result.closedCount}`);
}

export class PaymentCleanupWorker implements Worker {
    name = "payment-cleanup-worker";
    private worker?: BullMQWorker;

    start() {
        this.worker = new BullMQWorker(
            "payment-cleanup-queue",
            processPaymentCleanup,
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: 1,
            }
        );

        this.worker.on("completed", (job) => {
            logger.info(`[payment-cleanup-worker] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(`[payment-cleanup-worker] Job ${job?.id} failed: ${err.message}`);
        });

        this.worker.on("error", (err) => {
            logger.error(`[payment-cleanup-worker] Worker error: ${err.message}`);
        });

        this.worker.on("ready", () => {
            logger.info(`[payment-cleanup-worker] Ready — prefix: ${config.queue.prefix}`);
        });

        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[payment-cleanup-worker] ${signal} received — draining…`);
            if (this.worker) await this.worker.close();
            logger.info("[payment-cleanup-worker] Shutdown complete");
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

        paymentService.ensurePaymentCleanupRecurringJob().catch((err) => {
            logger.error(`[payment-cleanup-worker] Failed to schedule cleanup sweep: ${err.message}`);
        });
    }
}

const paymentCleanupWorkerInstance = new PaymentCleanupWorker();
workerRegistry.register(paymentCleanupWorkerInstance);
