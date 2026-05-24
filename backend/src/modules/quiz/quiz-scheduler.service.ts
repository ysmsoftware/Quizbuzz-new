/**
 * Quiz Scheduler Service
 *
 * Schedules BullMQ delayed jobs for contest lifecycle events.
 * Called when an admin publishes a contest — schedules:
 *   1. Contest auto-start at startTime
 *   2. Time warnings at configured intervals before endTime
 *   3. Auto-submit at endTime
 *   4. Identity audit capture requests (mid-point + random) for each participant
 *
 * All jobs are deduplicated via jobId — safe to call repeatedly.
 */

import logger from "../../config/logger";
import { quizTimerQueue, type QuizTimerJobPayload } from "../../queues";
import { config } from "../../config";

// Time warning intervals from env (seconds before endTime)
const TIME_WARNINGS = [
    config.quiz.timeWarning1, // 600s (10 min)
    config.quiz.timeWarning2, // 300s (5 min)
    config.quiz.timeWarning3, // 60s  (1 min)
].filter((v) => v > 0);

export class QuizSchedulerService {

    /**
     * Schedule all lifecycle events for a contest.
     * Call this when contest moves to PUBLISHED status.
     */
    async scheduleContestLifecycle(
        contestId: string,
        organizationId: string,
        startTime: Date,
        endTime: Date,
        showResultsAfter: number = 24,
    ): Promise<void> {
        const now = Date.now();

        // 1. Schedule contest start
        const startDelay = Math.max(0, startTime.getTime() - now);
        await this.scheduleJob({
            contestId,
            organizationId,
            type: "CONTEST_START",
        }, `start-${contestId}`, startDelay);

        logger.info(
            `[quiz-scheduler] Contest ${contestId} start scheduled in ${Math.round(startDelay / 1000)}s`,
        );

        // 2. Schedule time warnings (relative to endTime)
        for (const secondsBefore of TIME_WARNINGS) {
            const warningTime = endTime.getTime() - (secondsBefore * 1000);
            const warningDelay = Math.max(0, warningTime - now);

            if (warningDelay > 0) {
                await this.scheduleJob({
                    contestId,
                    organizationId,
                    type: "TIME_WARNING",
                    secondsRemaining: secondsBefore,
                }, `warning-${contestId}-${secondsBefore}`, warningDelay);
            }
        }

        // 3. Schedule auto-submit at endTime
        const endDelay = Math.max(0, endTime.getTime() - now);
        await this.scheduleJob({
            contestId,
            organizationId,
            type: "AUTO_SUBMIT",
        }, `autosubmit-${contestId}`, endDelay);

        logger.info(
            `[quiz-scheduler] Contest ${contestId} auto-submit scheduled in ${Math.round(endDelay / 1000)}s`,
        );

        // 4. Schedule auto-declare results at endTime + showResultsAfter hours
        if (showResultsAfter >= 0) {
            const declareDelay = Math.max(0, endTime.getTime() + (showResultsAfter * 3600 * 1000) - now);
            await this.scheduleJob({
                contestId,
                organizationId,
                type: "AUTO_DECLARE_RESULTS",
            }, `auto-declare-${contestId}`, declareDelay);

            logger.info(
                `[quiz-scheduler] Contest ${contestId} auto-declare scheduled in ${Math.round(declareDelay / 1000)}s (${showResultsAfter}h after end)`,
            );
        }
    }

    /**
     * Schedule identity audit snapshots for a specific participant.
     * Called when a participant enters the quiz phase.
     *
     * - MID_POINT: exactly at totalDuration / 2
     * - RANDOM:    random time between 25% and 75% of duration
     */
    async scheduleSnapshotCaptures(
        contestId: string,
        organizationId: string,
        participantId: string,
        durationMs: number,
    ): Promise<void> {
        const now = Date.now();

        // Mid-point capture
        const midDelay = Math.round(durationMs / 2);
        await this.scheduleJob({
            contestId,
            organizationId,
            type: "CAPTURE_REQUEST",
            participantId,
            captureType: "MID_POINT",
        }, `capture-mid-${participantId}`, midDelay);

        // Random capture (between 25% and 75% of duration)
        const minDelay = Math.round(durationMs * 0.25);
        const maxDelay = Math.round(durationMs * 0.75);
        const randomDelay = minDelay + Math.round(Math.random() * (maxDelay - minDelay));
        await this.scheduleJob({
            contestId,
            organizationId,
            type: "CAPTURE_REQUEST",
            participantId,
            captureType: "RANDOM",
        }, `capture-random-${participantId}`, randomDelay);

        logger.info(
            `[quiz-scheduler] Snapshot captures scheduled for ${participantId}: ` +
            `mid=${Math.round(midDelay / 1000)}s, random=${Math.round(randomDelay / 1000)}s`,
        );
    }

    /**
     * Cancel all scheduled jobs for a contest (e.g., contest cancelled).
     */
    async cancelContestJobs(contestId: string): Promise<void> {
        const jobIds = [
            `start-${contestId}`,
            `autosubmit-${contestId}`,
            `auto-declare-${contestId}`,
            ...TIME_WARNINGS.map((s) => `warning-${contestId}-${s}`),
        ];

        for (const jobId of jobIds) {
            try {
                const job = await quizTimerQueue.getJob(jobId);
                if (job) {
                    await job.remove();
                }
            } catch {
                // Job may already have been processed — ignore
            }
        }

        logger.info(`[quiz-scheduler] Cancelled all jobs for contest ${contestId}`);
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    private async scheduleJob(
        payload: QuizTimerJobPayload,
        jobId: string,
        delay: number,
    ): Promise<void> {
        await quizTimerQueue.add("quiz-timer", payload, {
            jobId,
            delay,
            attempts: config.queue.retryAttempts,
            backoff: {
                type: config.queue.backoff.type as "exponential",
                delay: config.queue.backoff.delay,
            },
            removeOnComplete: true,
            removeOnFail: { count: 100 },
        });
    }
}
