import { Worker as BullWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { Worker } from "./worker.interface";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { prisma } from "../config/db";
import { ViolationType } from "@prisma/client";
import { quizSession } from "../container";
import { CaptureMetadataJobPayload } from "../queues";

export class CaptureMetadataWorker implements Worker {
    public name = "CaptureMetadataWorker";
    private worker!: BullWorker;

    start(): void {
        this.worker = new BullWorker<CaptureMetadataJobPayload>(
            "capture-metadata-queue",
            async (job: Job<CaptureMetadataJobPayload>) => {
                const {
                    participantId,
                    contestId,
                    organizationId,
                    type,
                    storageKey,
                    severity,
                    metadata,
                    occurredAt,
                } = job.data;

                logger.info(`[capture-metadata-worker] Processing job ${job.id} of type: ${type} for participant: ${participantId}`);

                const isSnapshot = type.startsWith("SNAPSHOT_");

                // 1. If it's a real violation (not an audit snapshot), record it to Redis
                if (!isSnapshot) {
                    const severityStringMap: Record<number, "LOW" | "MEDIUM" | "HIGH"> = {
                        1: "LOW",
                        2: "MEDIUM",
                        3: "HIGH",
                    };
                    await quizSession.recordViolation(contestId, participantId, {
                        type: type as any,
                        severity: severityStringMap[severity ?? 1] || "LOW",
                        metadata: metadata || {},
                        timestamp: occurredAt || new Date().toISOString(),
                    });
                }

                // 2. Persist raw event to PostgreSQL
                await prisma.proctoringEvent.create({
                    data: {
                        participantId,
                        contestId,
                        organizationId,
                        type: type as ViolationType,
                        severity: severity ?? 1,
                        metadata: {
                            s3Key: storageKey,
                            ...(metadata || {}),
                        },
                        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
                    },
                });

                // 3. Upsert aggregated ProctoringScore if features are enabled
                if (config.features.proctoring && !isSnapshot) {
                    const activeViolationsCount = await prisma.proctoringEvent.count({
                        where: {
                            participantId,
                            contestId,
                            type: {
                                notIn: [
                                    "SNAPSHOT_START",
                                    "SNAPSHOT_MID_POINT",
                                    "SNAPSHOT_RANDOM",
                                    "SNAPSHOT_PRE_SUBMIT",
                                ] as any[],
                            },
                        },
                    });

                    const highSeverityCount = await prisma.proctoringEvent.count({
                        where: {
                            participantId,
                            contestId,
                            severity: 3,
                            type: {
                                notIn: [
                                    "SNAPSHOT_START",
                                    "SNAPSHOT_MID_POINT",
                                    "SNAPSHOT_RANDOM",
                                    "SNAPSHOT_PRE_SUBMIT",
                                ] as any[],
                            },
                        },
                    });

                    const trustScore = Math.max(0, 100 - activeViolationsCount * 10 - highSeverityCount * 20);
                    const isFlagged = activeViolationsCount >= config.proctoring.threshold;

                    await prisma.proctoringScore.upsert({
                        where: {
                            participantId_contestId: { participantId, contestId },
                        },
                        update: {
                            totalViolations: activeViolationsCount,
                            highSeverityCount,
                            trustScore,
                            isFlagged,
                            flaggedAt: isFlagged ? new Date() : null,
                        },
                        create: {
                            participantId,
                            contestId,
                            organizationId,
                            totalViolations: activeViolationsCount,
                            highSeverityCount,
                            trustScore,
                            isFlagged,
                            flaggedAt: isFlagged ? new Date() : null,
                        },
                    });

                    // 4. Publish disqualification / flag notification if threshold is reached
                    if (isFlagged) {
                        logger.warn(`[capture-metadata-worker] Participant ${participantId} has been flagged for contest ${contestId}`);
                        await redis.publish(
                            "quizbuzz:socket-emit",
                            JSON.stringify({
                                namespace: "participant",
                                room: `participant:${participantId}`,
                                event: "quiz:v1:flagged",
                                data: {
                                    totalViolations: activeViolationsCount,
                                    threshold: config.proctoring.threshold,
                                    flagged: true,
                                },
                            })
                        );
                    }
                }
            },
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: 5,
            }
        );

        this.worker.on("completed", (job) => {
            logger.info(`[capture-metadata-worker] Job ${job.id} completed successfully`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(`[capture-metadata-worker] Job ${job?.id} failed with error:`, err);
        });

        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[capture-metadata-worker] ${signal} received — draining in-flight jobs…`);
            if (this.worker) await this.worker.close();
            logger.info(`[capture-metadata-worker] Shutdown complete`);
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    }
}

const captureMetadataWorkerInstance = new CaptureMetadataWorker();
workerRegistry.register(captureMetadataWorkerInstance);
