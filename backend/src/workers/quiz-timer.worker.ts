/**
 * Quiz Timer Worker
 *
 * Processes time-based quiz lifecycle events scheduled as BullMQ delayed jobs:
 *   - CONTEST_START:   Transition waiting room → quiz for ready participants
 *   - TIME_WARNING:    Emit countdown warnings at configured intervals
 *   - AUTO_SUBMIT:     Force-submit all active participants at contest endTime
 *   - CAPTURE_REQUEST: Trigger identity audit snapshot for a participant
 *
 * Self-registers via workerRegistry.
 */

import { Worker as BullMQWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import type { Worker } from "./worker.interface";
import { quizTimerQueue } from "../queues";
import type { QuizTimerJobPayload } from "../queues";
import type { PrismaClient } from "@prisma/client";
import { QuizSession } from "../modules/quiz/quiz.session";

// ─── Late-bound references ────────────────────────────────────────────────────
// The gateway and services are initialized in container.ts and injected at
// startup. We use a setter pattern to avoid circular dependencies.

let quizGateway: {
    startQuizForParticipant: (pid: string, cid: string, oid: string, contactId: string) => Promise<void>;
    emitTimeWarning: (cid: string, seconds: number) => void;
    emitAutoSubmit: (pid: string, cid: string, reason: string) => Promise<void>;
    emitCaptureRequest: (pid: string, captureType: string) => Promise<void>;
    broadcastAdminEvent: (cid: string, event: string, data: unknown) => void;
} | null = null;

let quizService: {
    transitionToQuiz: (cid: string) => Promise<{ transitioned: string[]; blocked: string[] }>;
    handleTimeExpiry: (cid: string) => Promise<{ submitted: string[]; errors: Array<{ participantId: string; error: string }> }>;
    handleRejoin: (cid: string, pid: string) => Promise<any | null>;
} | null = null;

let contestService: {
    triggerEvaluation: (cid: string, oid: string) => Promise<any>;
    declareResults: (cid: string, oid: string) => Promise<any>;
} | null = null;

let prisma: PrismaClient | null = null;

/** Called from container.ts to inject dependencies after initialization */
export function injectTimerWorkerDeps(deps: {
    gateway: typeof quizGateway;
    quizService: typeof quizService;
    contestService: typeof contestService;
    prismaClient: PrismaClient;
}): void {
    quizGateway = deps.gateway;
    quizService = deps.quizService;
    contestService = deps.contestService;
    prisma = deps.prismaClient;
}

// ─── Job Processor ────────────────────────────────────────────────────────────

async function processTimerJob(job: Job<QuizTimerJobPayload>): Promise<void> {
    const { contestId, organizationId, type } = job.data;

    logger.info(
        `[quiz-timer] Processing ${type} for contest ${contestId} (job ${job.id})`,
    );

    switch (type) {
        case "CONTEST_START":
            await handleContestStart(contestId, organizationId);
            break;

        case "TIME_WARNING":
            await handleTimeWarning(contestId, job.data.secondsRemaining ?? 0);
            break;

        case "AUTO_SUBMIT":
            await handleAutoSubmit(contestId, organizationId);
            break;

        case "CAPTURE_REQUEST":
            await handleCaptureRequest(job.data.participantId!, job.data.captureType!);
            break;

        case "MARK_ABSENT":
            await handleMarkAbsent(contestId, organizationId);
            break;

        case "AUTO_DECLARE_RESULTS":
            await handleAutoDeclareResults(contestId, organizationId);
            break;

        default:
            logger.warn(`[quiz-timer] Unknown job type: ${type}`);
    }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleContestStart(contestId: string, organizationId: string): Promise<void> {
    if (!quizService || !quizGateway || !prisma) {
        logger.error(
            "[quiz-timer] CONTEST_START aborted — dependencies not injected. " +
            "Ensure worker.ts imports ./container before startWorkers().",
        );
        return;
    }

    // 1. Update contest status to LIVE
    await prisma.contest.update({
        where: { id: contestId },
        data: { status: "LIVE" },
    });

    // 2. Transition waiting-room participants (Redis set) to quiz
    const { transitioned, blocked } = await quizService.transitionToQuiz(contestId);

    logger.info(
        `[quiz-timer] Contest ${contestId} started: ${transitioned.length} transitioned, ${blocked.length} blocked`,
    );

    // 3. Start quiz for each participant who was in the Redis waiting set
    const startedPids = new Set<string>();
    for (const pid of transitioned) {
        try {
            const session = await quizService.handleRejoin(contestId, pid);
            const contactId = session?.contactId ?? "";
            await quizGateway.startQuizForParticipant(pid, contestId, organizationId, contactId);
            startedPids.add(pid);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`[quiz-timer] Failed to start quiz for ${pid}: ${msg}`);
        }
    }

    // 4. DB-level fallback: also start quiz for any REGISTERED/CHECKED_IN participants
    //    who were on the waiting page but whose socket never emitted quiz:v1:join
    //    (network blip, page refresh, slow connection, etc.)
    try {
        const dbParticipants = await prisma.participant.findMany({
            where: {
                contestId,
                organizationId,
                status: { in: ["REGISTERED", "CHECKED_IN", "IN_WAITING"] },
            },
            select: { id: true, contactId: true },
        });

        for (const p of dbParticipants) {
            if (startedPids.has(p.id)) continue; // already handled above
            try {
                await quizGateway.startQuizForParticipant(p.id, contestId, organizationId, p.contactId);
                logger.info(`[quiz-timer] DB-fallback: started quiz for ${p.id}`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error(`[quiz-timer] DB-fallback failed for ${p.id}: ${msg}`);
            }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[quiz-timer] DB-fallback query failed: ${msg}`);
    }

    // 5. Broadcast admin stats
    quizGateway.broadcastAdminEvent(contestId, "admin:v1:live-stats", {
        contestId,
        active: transitioned.length,
        submitted: 0,
        waiting: blocked.length,
        totalViolations: 0,
    });
}

async function handleTimeWarning(contestId: string, secondsRemaining: number): Promise<void> {
    if (!quizGateway) return;
    quizGateway.emitTimeWarning(contestId, secondsRemaining);
    logger.info(`[quiz-timer] Time warning emitted for contest ${contestId}: ${secondsRemaining}s remaining`);
}

async function handleAutoSubmit(contestId: string, organizationId: string): Promise<void> {
    if (!quizService || !quizGateway) return;

    const { submitted, errors } = await quizService.handleTimeExpiry(contestId);

    // Notify each submitted participant
    for (const pid of submitted) {
        await quizGateway.emitAutoSubmit(pid, contestId, "time_expired");
    }

    if (contestService) {
        try {
            await contestService.triggerEvaluation(contestId, organizationId);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(
                `[quiz-timer] Contest ${contestId} could not be moved to EVALUATION: ${msg}`
            );
        }
    }

    logger.info(
        `[quiz-timer] Auto-submit for contest ${contestId}: ${submitted.length} submitted, ${errors.length} errors`,
    );

    // Enqueue MARK_ABSENT delayed job (delay of 10 minutes to allow workers to flush and persist submissions)
    try {
        await quizTimerQueue.add(
            "mark-absent",
            {
                contestId,
                organizationId,
                type: "MARK_ABSENT",
            },
            {
                jobId: `MARK_ABSENT-${contestId}`,
                delay: 600000, // 10 minutes in ms
            }
        );
        logger.info(`[quiz-timer] Enqueued MARK_ABSENT job for contest ${contestId} with 10-minute delay`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[quiz-timer] Failed to enqueue MARK_ABSENT job for contest ${contestId}: ${msg}`);
    }
}

async function handleCaptureRequest(participantId: string, captureType: string): Promise<void> {
    if (!quizGateway) return;
    await quizGateway.emitCaptureRequest(participantId, captureType);
    logger.info(`[quiz-timer] Capture request sent to ${participantId}: ${captureType}`);
}

async function handleMarkAbsent(contestId: string, organizationId: string): Promise<void> {
    if (!prisma) {
        logger.error("[quiz-timer] Prisma client not injected for MARK_ABSENT");
        return;
    }

    logger.info(`[quiz-timer] Starting MARK_ABSENT processing for contest ${contestId}`);

    try {
        // Fetch participant IDs currently in live Redis sets (waiting, active, submitted)
        const session = new QuizSession();
        const [waitingIds, activeIds, submittedIds] = await Promise.all([
            session.getSetMembers(contestId, "waiting"),
            session.getSetMembers(contestId, "active"),
            session.getSetMembers(contestId, "submitted"),
        ]);
        
        const activeOrSubmittedIds = new Set([
            ...waitingIds,
            ...activeIds,
            ...submittedIds
        ]);

        // 1. Query database participants who are still in pre-quiz status AND DO NOT have any submission record
        const participants = await prisma.participant.findMany({
            where: {
                contestId,
                organizationId,
                status: {
                    in: ["REGISTERED", "CHECKED_IN", "IN_WAITING"],
                },
                submission: {
                    is: null,
                },
            },
            select: { id: true },
        });

        // Filter out any participants who are active/submitted in Redis or have a submission record
        const filteredParticipants = participants.filter(
            (p) => !activeOrSubmittedIds.has(p.id)
        );
        const participantIds = filteredParticipants.map((p) => p.id);
        logger.info(`[quiz-timer] Found ${participants.length} candidates, narrowed to ${participantIds.length} truly absent participants after Redis & DB submission exclusion.`);

        if (participantIds.length === 0) {
            logger.info(`[quiz-timer] No absent participants to process for contest ${contestId}`);
            return;
        }

        // 2. Chunk into batches of 500
        const batchSize = 500;
        const delayMs = 50;

        for (let i = 0; i < participantIds.length; i += batchSize) {
            const batch = participantIds.slice(i, i + batchSize);

            // 3. Update each batch in a transaction
            await prisma.$transaction(
                async (tx) => {
                    await tx.participant.updateMany({
                        where: {
                            id: { in: batch },
                            status: {
                                in: ["REGISTERED", "CHECKED_IN", "IN_WAITING"],
                            },
                        },
                        data: { status: "ABSENT" },
                    });
                },
                {
                    timeout: 5000, // 5s timeout
                }
            );

            logger.info(`[quiz-timer] Updated batch of ${batch.length} participants to ABSENT`);

            // Invalidate Redis cache key after each batch commit
            const cacheKey = `contest:status-summary:${contestId}`;
            await redis.del(cacheKey);

            // 4. Inter-batch delay of 50ms to prevent DB index lock contention
            if (i + batchSize < participantIds.length) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }

        logger.info(`[quiz-timer] Completed MARK_ABSENT processing for contest ${contestId}`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[quiz-timer] Error in MARK_ABSENT for contest ${contestId}: ${msg}`);
        throw err;
    }
}

async function handleAutoDeclareResults(contestId: string, organizationId: string): Promise<void> {
    if (!contestService || !prisma) {
        logger.error("[quiz-timer] AUTO_DECLARE_RESULTS aborted — dependencies not injected.");
        return;
    }

    // Check if contest has already had results declared (idempotent guard)
    const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        select: { status: true },
    });

    if (!contest) {
        logger.warn(`[quiz-timer] AUTO_DECLARE_RESULTS: Contest ${contestId} not found — skipping.`);
        return;
    }

    if (["RESULTS_OUT", "COMPLETED", "CANCELLED"].includes(contest.status)) {
        logger.info(
            `[quiz-timer] AUTO_DECLARE_RESULTS: Contest ${contestId} already in ${contest.status} — no-op.`,
        );
        return;
    }

    try {
        await contestService.declareResults(contestId, organizationId);
        logger.info(`[quiz-timer] AUTO_DECLARE_RESULTS: Successfully declared results for contest ${contestId}.`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[quiz-timer] AUTO_DECLARE_RESULTS failed for contest ${contestId}: ${msg}`);
        throw err; // Let BullMQ retry
    }
}

// ─── Worker Registration ──────────────────────────────────────────────────────

export class QuizTimerWorker implements Worker {
    name = "quiz-timer-worker";
    private worker?: BullMQWorker<QuizTimerJobPayload>;

    start(): void {
        this.worker = new BullMQWorker<QuizTimerJobPayload>(
            "quiz-timer-queue",
            processTimerJob,
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: config.queue.concurrency,
            },
        );

        this.worker.on("completed", (job) => {
            logger.info(`[quiz-timer] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(
                `[quiz-timer] Job ${job?.id} failed: ${err.message}`,
            );
        });

        this.worker.on("error", (err) => {
            logger.error(`[quiz-timer] Worker error: ${err.message}`);
        });

        this.worker.on("ready", () => {
            logger.info(
                `[quiz-timer] Ready — concurrency: ${config.queue.concurrency}`,
            );
        });
    }
}

const quizTimerWorkerInstance = new QuizTimerWorker();
workerRegistry.register(quizTimerWorkerInstance);
