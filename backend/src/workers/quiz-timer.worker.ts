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
import type { QuizTimerJobPayload } from "../queues";
import type { PrismaClient } from "@prisma/client";

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

        default:
            logger.warn(`[quiz-timer] Unknown job type: ${type}`);
    }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleContestStart(contestId: string, organizationId: string): Promise<void> {
    if (!quizService || !quizGateway || !prisma) {
        logger.error("[quiz-timer] Dependencies not injected");
        return;
    }

    // 1. Update contest status to LIVE
    await prisma.contest.update({
        where: { id: contestId },
        data: { status: "LIVE" },
    });

    // 2. Transition ready participants from waiting room
    const { transitioned, blocked } = await quizService.transitionToQuiz(contestId);

    logger.info(
        `[quiz-timer] Contest ${contestId} started: ${transitioned.length} transitioned, ${blocked.length} blocked`,
    );

    // 3. Start quiz for each transitioned participant
    for (const pid of transitioned) {
        try {
            const session = await quizService.handleRejoin(contestId, pid);
            const contactId = session?.contactId ?? "";
            await quizGateway.startQuizForParticipant(pid, contestId, organizationId, contactId);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`[quiz-timer] Failed to start quiz for ${pid}: ${msg}`);
        }
    }

    // 4. Broadcast admin stats
    quizGateway.broadcastAdminEvent(contestId, "admin:live-stats", {
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
}

async function handleCaptureRequest(participantId: string, captureType: string): Promise<void> {
    if (!quizGateway) return;
    await quizGateway.emitCaptureRequest(participantId, captureType);
    logger.info(`[quiz-timer] Capture request sent to ${participantId}: ${captureType}`);
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
