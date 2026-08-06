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
import { quizTimerQueue, messageQueue, type QuizTimerJobPayload } from "../../queues";
import { config } from "../../config";
import { MessageTemplate } from "../../types/message-template.enum";

// Pre-start reminder offsets (ms before startTime), keyed by the job-id suffix used
// to schedule/cancel them. Adding a reminder means adding one entry here — nothing
// else in the codebase needs to know about it.
const REMINDER_OFFSETS: ReadonlyArray<{ id: string; msBefore: number }> = [
    { id: "24h", msBefore: 24 * 60 * 60 * 1000 },
    { id: "1h", msBefore: 60 * 60 * 1000 },
];

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
     * (Re)schedule the pre-start reminder notifications for a contest.
     *
     * Cancels any existing reminders first so this is safe to call on publish and on
     * every reschedule — the same reason scheduleJob evicts before adding. Reminders
     * whose send time has already passed are skipped rather than fired immediately.
     */
    async scheduleReminders(
        contestId: string,
        organizationId: string,
        startTime: Date,
    ): Promise<void> {
        await this.cancelReminders(contestId);

        const now = Date.now();
        const startMs = startTime.getTime();

        for (const { id, msBefore } of REMINDER_OFFSETS) {
            const delay = startMs - msBefore - now;
            if (delay <= 0) continue;

            await messageQueue.add(
                "bulk-notify",
                { contestId, organizationId, template: MessageTemplate.WORKSHOP_REMINDER_MESSAGE },
                { delay, jobId: this.reminderJobId(contestId, id) },
            );
            logger.info(`[quiz-scheduler] Scheduled ${id} reminder for contest ${contestId}`);
        }
    }

    /**
     * Queue the post-contest absentee sweep.
     *
     * Delayed so submission workers have time to flush and persist before anyone is
     * judged absent. Shared by both termination paths — the scheduled AUTO_SUBMIT job
     * and an admin force-end — so the grace period can never differ between them.
     */
    async scheduleMarkAbsent(contestId: string, organizationId: string): Promise<void> {
        await quizTimerQueue.add(
            "mark-absent",
            { contestId, organizationId, type: "MARK_ABSENT" },
            {
                jobId: `MARK_ABSENT-${contestId}`,
                delay: config.quiz.markAbsentDelay * 1000,
            },
        );
        logger.info(
            `[quiz-scheduler] MARK_ABSENT for contest ${contestId} queued in ${config.quiz.markAbsentDelay}s`,
        );
    }

    /** Remove all pending pre-start reminders for a contest. */
    async cancelReminders(contestId: string): Promise<void> {
        for (const { id } of REMINDER_OFFSETS) {
            const jobId = this.reminderJobId(contestId, id);
            try {
                const job = await messageQueue.getJob(jobId);
                if (job) await job.remove();
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error(`[quiz-scheduler] Failed to remove reminder ${jobId}: ${msg}`);
            }
        }
    }

    private reminderJobId(contestId: string, offsetId: string): string {
        return `reminder-${offsetId}-${contestId}`;
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

        const failed: string[] = [];

        for (const jobId of jobIds) {
            try {
                const job = await quizTimerQueue.getJob(jobId);
                if (job) {
                    await job.remove();
                }
            } catch (err) {
                // A removal failure is NOT harmless: scheduleJob re-adds with the same
                // jobId, and BullMQ silently ignores add() when that id still exists —
                // so the surviving job keeps its ORIGINAL delay and the contest fires on
                // the old schedule. Surface it instead of swallowing it. The timer worker
                // additionally re-validates each job against the contest's current
                // startTime/endTime, so this is logged rather than thrown.
                failed.push(jobId);
                const msg = err instanceof Error ? err.message : String(err);
                logger.error(
                    `[quiz-scheduler] FAILED to remove job ${jobId} for contest ${contestId}: ${msg}. ` +
                    `A stale job may remain queued on the old schedule.`,
                );
            }
        }

        if (failed.length > 0) {
            logger.warn(
                `[quiz-scheduler] Cancelled jobs for contest ${contestId} with ${failed.length} ` +
                `failure(s): ${failed.join(", ")}`,
            );
        } else {
            logger.info(`[quiz-scheduler] Cancelled all jobs for contest ${contestId}`);
        }
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    private async scheduleJob(
        payload: QuizTimerJobPayload,
        jobId: string,
        delay: number,
    ): Promise<void> {
        // BullMQ treats jobId as an idempotency key: add() is a silent no-op when a
        // job with the same id already exists. On a reschedule that means the NEW
        // delay is discarded and the OLD one survives — the exact failure mode behind
        // "I moved the start time but the contest still began at the old time".
        // Explicitly evict any leftover before adding so the new delay always wins.
        try {
            const existing = await quizTimerQueue.getJob(jobId);
            if (existing) {
                await existing.remove();
                logger.info(`[quiz-scheduler] Evicted pre-existing job ${jobId} before rescheduling`);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(
                `[quiz-scheduler] Could not evict existing job ${jobId}: ${msg}. ` +
                `The new delay may not apply — the timer worker's staleness check is the backstop.`,
            );
        }

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
