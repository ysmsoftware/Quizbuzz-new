/**
 * Evaluation Worker
 *
 * Responsibility: load a persisted Submission + its Answer rows, load the
 * contest's scoring configuration (marks, negative marks, correct options),
 * score every answer, then write the results back via SubmissionService.
 * After evaluation, queue leaderboard build so the leaderboard can be populated.
 *
 * Standalone process:
 *   node dist/workers/evaluation.worker.js
 *
 * Depends on: submissionService, questionRepository (read-only scoring data), leaderboardRepository
 * Writes via: submissionService.applyEvaluationResult (→ submissionRepository)
 *            leaderboardQueue.add (→ leaderboard worker)
 */

import { Worker as BullMQWorker, Job, UnrecoverableError } from "bullmq";
import { Prisma, SubmissionStatus } from "@prisma/client";
const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
import { redis } from "../config/redis";
import { config } from "../config";
import { submissionService } from "../container";
import { questionRepository } from "../container";
import { leaderboardRepository } from "../container";
import { EvaluationJobPayload } from "../modules/submission/submission.types";
import { ApplyEvaluationInput } from "../modules/submission/submission.types";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { Worker } from "./worker.interface";
import { leaderboardQueue } from "../queues";

// ─── Scoring logic (pure function — no I/O, fully unit-testable) ──────────────

interface ScoringConfig {
    questionId: string;
    marks: number;
    negativeMark: string;  // stored as string from repo (Decimal.toString())
    correctOptionId: string;
}

interface RawAnswer {
    questionId: string;
    selectedOptionId: string | null;
}

interface ScoredAnswer {
    questionId: string;
    isCorrect: boolean;
    marksAwarded: Decimal;
}

interface ScoreResult {
    correct: number;
    wrong: number;
    skipped: number;
    attempted: number;
    score: Decimal;
    percentage: Decimal;
    scoredAnswers: ScoredAnswer[];
}

/**
 * Pure scoring function. Takes the raw answers from the submission and the
 * scoring config from contest_questions, returns complete scored results.
 *
 * Rules:
 *  - Correct answer  → +marks
 *  - Wrong answer    → -negativeMark  (floored at 0 total, never goes negative)
 *  - Skipped answer  → 0
 *  - Score floor     → 0  (total score can never be negative)
 */
export function scoreSubmission(
    answers: RawAnswer[],
    scoringMap: Map<string, ScoringConfig>,
    maxPossibleScore: Decimal
): ScoreResult {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let score = new Decimal(0);

    const scoredAnswers: ScoredAnswer[] = answers.map((answer) => {
        const config = scoringMap.get(answer.questionId);

        // Question not in scoring map — treat as skipped (contest config mismatch)
        if (!config) {
            skipped++;
            return {
                questionId: answer.questionId,
                isCorrect: false,
                marksAwarded: new Decimal(0),
            };
        }

        // Skipped
        if (answer.selectedOptionId === null) {
            skipped++;
            return {
                questionId: answer.questionId,
                isCorrect: false,
                marksAwarded: new Decimal(0),
            };
        }

        // Correct
        if (answer.selectedOptionId === config.correctOptionId) {
            correct++;
            const marks = new Decimal(config.marks);
            score = score.plus(marks);
            return {
                questionId: answer.questionId,
                isCorrect: true,
                marksAwarded: marks,
            };
        }

        // Wrong — apply negative marking
        wrong++;
        const deduction = new Decimal(config.negativeMark);
        score = score.minus(deduction);
        // marksAwarded stored as negative to show the deduction in the UI
        return {
            questionId: answer.questionId,
            isCorrect: false,
            marksAwarded: deduction.negated(),
        };
    });

    // Floor total score at 0 — a participant cannot have a negative score
    if (score.lessThan(0)) {
        score = new Decimal(0);
    }

    // Percentage — guard against zero max score (edge case: all questions
    // have 0 marks, which should never happen but must not cause division by zero)
    const percentage = maxPossibleScore.greaterThan(0)
        ? score.dividedBy(maxPossibleScore).times(100).toDecimalPlaces(2)
        : new Decimal(0);

    return {
        correct,
        wrong,
        skipped,
        attempted: correct + wrong,
        score,
        percentage,
        scoredAnswers,
    };
}

async function incrementEvalCounter(
    contestId: string,
    totalCount: number,
): Promise<{ evaluated: number; total: number }> {
    const key = `leaderboard:eval-counter:${contestId}`;
    // INCR is atomic — safe under concurrent workers across multiple instances
    const evaluated = await redis.incr(key);
    // Set TTL only on first increment to avoid resetting it on every job
    if (evaluated === 1) {
        await redis.expire(key, 48 * 60 * 60); // 48 hours
    }
    return { evaluated, total: totalCount };
}

// ─── Worker processor ─────────────────────────────────────────────────────────

async function processEvaluation(job: Job<EvaluationJobPayload>): Promise<void> {
    const { organizationId, submissionId, participantId, contestId } = job.data;

    logger.info(
        `[evaluation-worker] Job ${job.id} started — submission: ${submissionId} contest: ${contestId} attempt: ${job.attemptsMade + 1}/${config.queue.retryAttempts}`
    );

    // ── Step 1: Validate payload ──────────────────────────────────────────────

    if (!submissionId || !organizationId || !contestId || !participantId) {
        throw new UnrecoverableError(
            `[evaluation-worker] Invalid payload: missing required fields. ` +
            `submissionId=${submissionId} organizationId=${organizationId}`
        );
    }
    await job.updateProgress(10);

    // ── Step 2: Load submission (with all answer rows) ────────────────────────

    const submission = await submissionService.getSubmissionById(
        organizationId,
        submissionId
    );

    // Already evaluated — idempotency: mark job done without re-scoring
    if (submission.status === "EVALUATED") {
        logger.warn(
            `[evaluation-worker] Submission ${submissionId} already EVALUATED — skipping`
        );
        await job.updateProgress(100);
        return;
    }

    if (submission.status === "INVALIDATED") {
        // Do not evaluate disqualified submissions
        throw new UnrecoverableError(
            `[evaluation-worker] Submission ${submissionId} is INVALIDATED — will not evaluate`
        );
    }

    if (submission.status !== "SUBMITTED") {
        // PENDING means the submission worker hasn't persisted it yet — this
        // should not happen (submission worker enqueues evaluation only after
        // persist succeeds) but guard anyway.
        throw new Error(
            `[evaluation-worker] Submission ${submissionId} has unexpected status "${submission.status}" — will retry`
        );
    }
    await job.updateProgress(30);

    // ── Step 3: Load scoring configuration from contest_questions ────────────
    // Uses QuestionRepository directly — evaluation worker is the only consumer
    // of this data and it is read-only. No SubmissionService method wraps this
    // because scoring config is owned by the Question domain, not Submission.

    const scoringRows = await questionRepository.getContestQuestionsWithScoringData(
        contestId,
        organizationId
    );

    if (scoringRows.length === 0) {
        throw new UnrecoverableError(
            `[evaluation-worker] No scoring data found for contest ${contestId} — ` +
            `contest may have been deleted or has no questions`
        );
    }

    // Build O(1) lookup map: questionId → scoring config
    const scoringMap = new Map<string, ScoringConfig>(
        scoringRows.map((r) => [r.questionId, r])
    );

    // Compute max possible score (sum of all question marks)
    const maxPossibleScore = scoringRows.reduce(
        (sum, r) => sum.plus(new Decimal(r.marks)),
        new Decimal(0)
    );
    await job.updateProgress(50);

    // ── Step 4: Map submission answers to RawAnswer shape ─────────────────────
    // submission.answers are AnswerDetail objects — extract only what scoring needs

    const rawAnswers: RawAnswer[] = submission.answers.map((a) => ({
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
    }));

    // ── Step 5: Score every answer (pure function — no I/O) ──────────────────

    const result = scoreSubmission(rawAnswers, scoringMap, maxPossibleScore);

    logger.info(
        `[evaluation-worker] Job ${job.id} — scored: correct=${result.correct} wrong=${result.wrong} skipped=${result.skipped} score=${result.score} percentage=${result.percentage}`
    );
    await job.updateProgress(70);

    // ── Step 6: Persist results via SubmissionService ─────────────────────────
    // Converts Decimal → Prisma.Decimal for DB write.

    const applyInput: ApplyEvaluationInput = {
        correct: result.correct,
        wrong: result.wrong,
        skipped: result.skipped,
        attempted: result.attempted,
        score: result.score,
        percentage: result.percentage,
        evaluatedAt: new Date(),
        scoredAnswers: result.scoredAnswers.map((a) => ({
            questionId: a.questionId,
            isCorrect: a.isCorrect,
            marksAwarded: a.marksAwarded,
        })),
    };

    await submissionService.applyEvaluationResult(
        organizationId,
        submissionId,
        applyInput
    );

    logger.info(
        `[evaluation-worker] Job ${job.id} complete — submission ${submissionId} evaluated`
    );
    await job.updateProgress(90);

    // ── Step 7: Track evaluation progress, trigger leaderboard build when done ──
    const totalSubmitted = await submissionService.countByContest(
        contestId,
        organizationId,
        ["SUBMITTED", "EVALUATED"] as SubmissionStatus[]
    );

    const countedKey = `leaderboard:counted:${contestId}:${submissionId}`;
    const alreadyCounted = await redis.set(countedKey, "1", "EX", 48 * 60 * 60, "NX");
    let evaluated: number;

    if (alreadyCounted) {
        ({ evaluated } = await incrementEvalCounter(contestId, totalSubmitted));
    } else {
        const current = await redis.get(`leaderboard:eval-counter:${contestId}`);
        evaluated = current ? Number(current) : 0;
        logger.warn(
            `[evaluation-worker] Submission ${submissionId} already counted — skipping counter increment`
        );
    }

    logger.info(
        `[evaluation-worker] Contest ${contestId}: ${evaluated}/${totalSubmitted} evaluated`
    );

    // The last job to finish fires the leaderboard build.
    // Using Redis INCR guarantees exactly one worker sees the final evaluated count.
    if (evaluated >= totalSubmitted) {
        await leaderboardQueue.add(
            "build-leaderboard",
            { contestId, organizationId },
            {
                jobId: `leaderboard-${contestId}`, // deduplicated
                removeOnComplete: true,
                removeOnFail: { count: 100 },
            },
        );
        logger.info(
            `[evaluation-worker] All ${totalSubmitted} submissions evaluated — leaderboard build queued for contest ${contestId}`
        );
    }

    await job.updateProgress(100);
}

// ─── Worker registration ──────────────────────────────────────────────────────

export class EvaluationWorker implements Worker {
    name = "evaluation-worker";
    private worker?: BullMQWorker<EvaluationJobPayload>;

    start() {
        this.worker = new BullMQWorker<EvaluationJobPayload>(
            "evaluation-queue",
            processEvaluation,
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: config.queue.concurrency,
            }
        );

        // ─── Worker lifecycle events ──────────────────────────────────────────────────

        this.worker.on("completed", (job) => {
            logger.info(`[evaluation-worker] Job ${job.id} completed`);
        });

        this.worker.on("failed", (job, err) => {
            const permanent = err instanceof UnrecoverableError;
            logger.error(
                `[evaluation-worker] Job ${job?.id} failed (${permanent ? "permanent" : `attempt ${job?.attemptsMade}`}): ${err.message}`
            );
        });

        this.worker.on("error", (err) => {
            logger.error(`[evaluation-worker] Worker error: ${err.message}`);
        });

        this.worker.on("ready", () => {
            logger.info(
                `[evaluation-worker] Ready — concurrency: ${config.queue.concurrency} prefix: ${config.queue.prefix}`
            );
        });

        // ─── Graceful shutdown ────────────────────────────────────────────────────────

        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[evaluation-worker] ${signal} received — draining…`);
            if (this.worker) await this.worker.close();
            logger.info(`[evaluation-worker] Shutdown complete`);
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    }
}

const evaluationWorkerInstance = new EvaluationWorker();
workerRegistry.register(evaluationWorkerInstance);
