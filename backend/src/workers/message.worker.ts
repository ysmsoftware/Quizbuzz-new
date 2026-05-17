import { Worker as BullMQWorker } from "bullmq";

import { MessageWorkerService } from "./message.worker.service";
import { redis } from "../config/redis";
import { workerRegistry } from "./worker.registry";
import { Worker } from "./worker.interface";
import { MessagingService } from "../modules/messaging/messaging.service";
import { MessagingRepository } from "../modules/messaging/messaging.repository";
import { ParticipantRepository } from "../modules/participant/participant.repository";
import logger from "../config/logger";
import { config } from "../config";

export class MessageWorker implements Worker {
    name = "message-worker";

    constructor(
        private workerService: MessageWorkerService,
        private messageService: MessagingService
    ) { }

    start() {
        const worker = new BullMQWorker(
            "message-queue",
            async (job) => {
                switch (job.name) {
                    case "send-message":
                        await this.workerService.process(job.data.messageLogId);
                        break;
                    case "bulk-notify":
                        await this.workerService.processBulkNotify(job.data);
                        break;
                    default:
                        logger.warn(`[message-worker] Unknown job name: ${job.name}`);
                }
            },
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: 10,
            }
        );

        worker.on("ready", () => {
            logger.info(`[message-worker] Ready — concurrency: 10 prefix: ${config.queue.prefix}`);
        });

        worker.on("failed", async (job, err) => {
            if (!job) return;

            const maxAttempts = job.opts.attempts ?? 1;
            if (job.attemptsMade >= maxAttempts) {
                // Only mark as FAILED for send-message jobs (bulk-notify doesn't have a messageLogId)
                if (job.name === "send-message" && job.data.messageLogId) {
                    await this.messageService.updateMessageStatus(job.data.messageLogId, "FAILED");
                }
            }

            logger.error(
                `[message-worker] Job ${job.id} (${job.name}) failed (attempt ${job.attemptsMade}): ${err.message}`
            );
        });

        worker.on("completed", (job) => {
            logger.info(`[message-worker] Job ${job.id} (${job.name}) completed`);
        });
    }
}

const participantRepo = new ParticipantRepository();
const messageRepo = new MessagingRepository();
const messageService = new MessagingService(messageRepo, participantRepo);
const workerService = new MessageWorkerService(messageService);
const messageWorker = new MessageWorker(workerService, messageService);

workerRegistry.register(messageWorker);