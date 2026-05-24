import { Worker as BullWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import { analyticsService } from "../container";
import { Worker } from "./worker.interface";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { QuizSession } from "../modules/quiz/quiz.session";
import { prisma } from "../config/db";

/**
 * Flush Redis participant phase state → DB.
 * Called by the analytics worker on every snapshot cycle.
 *
 * This is the ONLY place where participant.status is written to the DB
 * during a live quiz. The quiz service itself never writes status to DB.
 *
 * Phase → DB status mapping:
 *   WAITING   → IN_WAITING
 *   IN_QUIZ   → IN_QUIZ
 *   SUBMITTED → SUBMITTED
 *   DISCONNECTED is tracked in Redis only (no DB status for it)
 */
async function flushParticipantStatuses(
    session: QuizSession,
    contestId: string
): Promise<void> {
    const [waitingIds, activeIds, submittedIds] = await Promise.all([
        session.getSetMembers(contestId, "waiting"),
        session.getSetMembers(contestId, "active"),
        session.getSetMembers(contestId, "submitted"),
    ]);

    const ops: Promise<any>[] = [];

    if (waitingIds.length > 0) {
        ops.push(
            prisma.participant.updateMany({
                where: { id: { in: waitingIds } },
                data:  { status: "IN_WAITING" },
            })
        );
    }
    if (activeIds.length > 0) {
        ops.push(
            prisma.participant.updateMany({
                where: { id: { in: activeIds } },
                data:  { status: "IN_QUIZ" },
            })
        );
    }
    if (submittedIds.length > 0) {
        ops.push(
            prisma.participant.updateMany({
                where: { id: { in: submittedIds } },
                data:  { status: "SUBMITTED" },
            })
        );
    }

    await Promise.all(ops);

    const total = waitingIds.length + activeIds.length + submittedIds.length;
    if (total > 0) {
        logger.info(
            `[analytics-worker] Flushed ${total} participant statuses to DB ` +
            `(waiting=${waitingIds.length} active=${activeIds.length} submitted=${submittedIds.length})`
        );
    }
}

export class AnalyticsWorker implements Worker {
    public name = "AnalyticsWorker";
    private worker!: BullWorker;
    private session = new QuizSession();

    start(): void {
        this.worker = new BullWorker(
            "analytics-queue",
            async (job: Job) => {
                logger.info(`[analytics-worker] Processing job: ${job.name}`);

                if (job.name === "compute-all-snapshots") {
                    await analyticsService.processAllSnapshots();

                    // ── Flush Redis participant statuses → DB ──────────────────────────
                    // Find all contests currently LIVE so we know which contest IDs to flush
                    const liveContests = await prisma.contest.findMany({
                        where:  { status: { in: ["LIVE", "REGISTRATION_CLOSED"] } },
                        select: { id: true },
                    });
                    await Promise.all(
                        liveContests.map(c => flushParticipantStatuses(this.session, c.id))
                    );

                } else if (job.name === "compute-contest-snapshot") {
                    const { contestId, organizationId } = job.data;
                    await analyticsService.generateSnapshot(contestId, organizationId);
                    // Flush for this specific contest
                    await flushParticipantStatuses(this.session, contestId);
                }
            },
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: 1,
            }
        );

        this.worker.on("completed", (job) => {
            logger.info(`[analytics-worker] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(`[analytics-worker] Job ${job?.id} failed:`, err);
        });

        // ─── Graceful shutdown ────────────────────────────────────────────────────────
        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[analytics-worker] ${signal} received — draining in-flight jobs…`);
            if (this.worker) await this.worker.close();
            logger.info(`[analytics-worker] Shutdown complete`);
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT",  () => shutdown("SIGINT"));

        analyticsService.ensureRecurringJob().catch(err => {
            logger.error(`[analytics-worker] Failed to ensure recurring job:`, err);
        });
    }
}

const analyticsWorkerInstance = new AnalyticsWorker();
workerRegistry.register(analyticsWorkerInstance);
