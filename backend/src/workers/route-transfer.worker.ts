/**
 * Route Transfer Worker
 *
 * Responsibility:
 *   Dequeue a RouteTransferJobPayload and execute the Razorpay Route transfer
 *   for a captured payment via PayoutService.createRouteTransferForPayment.
 *
 * Why this is a queue instead of an inline call from the webhook handler:
 *   PaymentService.handleWebhook is the single source of truth for payment state
 *   and must stay fast and reliable under high registration traffic. Firing the
 *   transfer as an in-process fire-and-forget promise means a process crash or
 *   restart between the webhook responding and that promise resolving silently
 *   drops the transfer — no retry, no record beyond a log line. Routing it
 *   through BullMQ instead gets:
 *     - durability (the job survives a process restart)
 *     - automatic retries with backoff (config.queue.retryAttempts / backoff)
 *     - a scheduling delay (config.payout.transferDelayMs) as a safety window
 *       before funds actually leave the primary account
 *   without ever blocking the webhook response.
 *
 * Standalone process:
 *   node dist/workers/route-transfer.worker.js
 */

import { Worker as BullMQWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { payoutService, paymentService } from "../container";
import { RouteTransferJobPayload } from "../queues";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { Worker } from "./worker.interface";

// Route transfers hit the Razorpay Transfer API directly — kept deliberately
// low-concurrency (relative to the general worker pool) so a burst of captured
// payments doesn't hammer Razorpay's rate limits. Same pattern as
// certificate.worker.ts's CERT_CONCURRENCY, scaled from config, not hardcoded.
const TRANSFER_CONCURRENCY = Math.max(1, Math.floor(config.queue.concurrency / 5));

async function processRouteTransfer(job: Job<RouteTransferJobPayload>): Promise<void> {
    // The recurring reconciliation job shares this queue/worker but carries no per-payment
    // payload — dispatch on job.name before touching job.data as a RouteTransferJobPayload.
    if (job.name === "reconcile-transfers") {
        logger.info(`[route-transfer-worker] Job ${job.id} started — periodic reconciliation sweep`);
        const result = await paymentService.reconcileStuckTransfers();
        logger.info(
            `[route-transfer-worker] Job ${job.id} complete — reconciliation sweep: missing=${result.missingCount} stuck=${result.stuckCount}`
        );
        return;
    }

    const { paymentId, organizationId, amount, razorpayPaymentId, currency, forceRetry } = job.data;

    logger.info(
        `[route-transfer-worker] Job ${job.id} started — payment: ${paymentId} attempt: ${job.attemptsMade + 1}/${config.queue.retryAttempts}${forceRetry ? " (forced retry)" : ""}`
    );

    const result = await payoutService.createRouteTransferForPayment(
        {
            id: paymentId,
            organizationId,
            amount,
            razorpayPaymentId,
            currency,
        },
        { forceRetry }
    );

    logger.info(
        `[route-transfer-worker] Job ${job.id} complete — payment: ${paymentId} status: ${result?.status ?? "skipped (no razorpayPaymentId)"}`
    );
}

export class RouteTransferWorker implements Worker {
    name = "route-transfer-worker";
    private worker?: BullMQWorker<RouteTransferJobPayload>;

    start() {
        this.worker = new BullMQWorker<RouteTransferJobPayload>(
            "route-transfer-queue",
            processRouteTransfer,
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: TRANSFER_CONCURRENCY,
            }
        );

        this.worker.on("completed", (job) => {
            logger.info(`[route-transfer-worker] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(
                `[route-transfer-worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`,
                { paymentId: job?.data?.paymentId }
            );
        });

        this.worker.on("error", (err) => {
            logger.error(`[route-transfer-worker] Worker error: ${err.message}`);
        });

        this.worker.on("ready", () => {
            logger.info(
                `[route-transfer-worker] Ready — concurrency: ${TRANSFER_CONCURRENCY} prefix: ${config.queue.prefix}`
            );
        });

        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[route-transfer-worker] ${signal} received — draining…`);
            if (this.worker) await this.worker.close();
            logger.info("[route-transfer-worker] Shutdown complete");
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

        paymentService.ensureReconciliationRecurringJob().catch((err) => {
            logger.error(`[route-transfer-worker] Failed to schedule reconciliation sweep: ${err.message}`);
        });
    }
}

const routeTransferWorkerInstance = new RouteTransferWorker();
workerRegistry.register(routeTransferWorkerInstance);
