import { prisma } from "../../config/db";
import { config } from "../../config";
import logger from "../../config/logger";
import { QuizSession } from "../quiz/quiz.session";
import { SavedAnswer } from "../quiz/quiz.types";
import { progressSnapshotQueue } from "../../queues";
import { DurabilityRepository } from "./durability.repository";
import { ProgressSnapshotRow, RehydrateResult } from "./durability.types";

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

export class DurabilityService {
    constructor(
        private readonly repository: DurabilityRepository,
        private readonly session: QuizSession,
    ) { }

    /**
     * Periodic sweep: snapshots every live-contest participant's Redis progress
     * into participant_progress_snapshots, batched to bound both Redis pipeline
     * size and DB write size per cycle.
     */
    async snapshotAllLiveContests(): Promise<{ contestsSwept: number; participantsSnapshotted: number }> {
        const liveContests = await prisma.contest.findMany({
            where: { status: { in: ["LIVE", "REGISTRATION_CLOSED"] } },
            select: { id: true, organizationId: true },
        });

        let participantsSnapshotted = 0;

        for (const contest of liveContests) {
            const pids = await this.session.getAllKnownParticipants(contest.id);
            if (pids.length === 0) continue;

            const batches = chunk(pids, config.durability.snapshotBatchSize);
            for (const concurrentSlice of chunk(batches, config.durability.snapshotBatchConcurrency)) {
                const counts = await Promise.all(
                    concurrentSlice.map((batch) => this.snapshotBatch(contest.id, contest.organizationId, batch))
                );
                participantsSnapshotted += counts.reduce((sum, c) => sum + c, 0);
            }
        }

        return { contestsSwept: liveContests.length, participantsSnapshotted };
    }

    private async snapshotBatch(contestId: string, organizationId: string, pids: string[]): Promise<number> {
        const snapshots = await this.session.getManyParticipantSnapshots(contestId, pids);

        const rows: ProgressSnapshotRow[] = [];
        for (const [participantId, snap] of snapshots) {
            // No live session (never joined / already expired) or nothing new to
            // persist yet — skip, nothing to recover here.
            if (!snap.session || Object.keys(snap.answers).length === 0) continue;

            rows.push({
                organizationId,
                contestId,
                participantId,
                phase: snap.session.phase,
                answers: snap.answers,
                questionOrder: snap.questionOrder,
                currentQuestion: snap.session.currentQuestion,
                totalQuestions: snap.session.totalQuestions,
                violationCount: snap.session.violationCount,
                startedAt: snap.session.startedAt ? new Date(snap.session.startedAt) : null,
                contestEndTime: snap.session.contestEndTime ? new Date(snap.session.contestEndTime) : null,
            });
        }

        if (rows.length === 0) return 0;
        await this.repository.upsertManyProgressSnapshots(rows);
        return rows.length;
    }

    /**
     * Ensures the recurring snapshot job is scheduled in BullMQ.
     * Same pattern as AnalyticsService.ensureRecurringJob() — remove any
     * existing repeatable job first so a worker restart never double-schedules.
     */
    async ensureRecurringJob(): Promise<void> {
        const jobId = "periodic-progress-snapshot";
        const intervalMs = config.durability.snapshotIntervalMinutes * 60 * 1000;

        const repeatables = await progressSnapshotQueue.getRepeatableJobs();
        const existing = repeatables.find((repeatable) => repeatable.id === jobId);
        if (existing) {
            await progressSnapshotQueue.removeRepeatableByKey(existing.key);
        }

        await progressSnapshotQueue.add("snapshot-all-live-contests", {}, {
            jobId,
            repeat: { every: intervalMs },
            removeOnComplete: true,
            removeOnFail: true,
        });

        logger.info(`[durability-service] Recurring progress snapshot scheduled every ${config.durability.snapshotIntervalMinutes} minutes`);
    }

    /**
     * Rebuilds a submittable answer array from the last snapshot taken for a
     * participant whose live Redis session is gone. Returns null if no snapshot
     * exists — caller falls back to the existing zero-answer path.
     */
    async rehydrateParticipant(contestId: string, participantId: string): Promise<RehydrateResult | null> {
        const row = await this.repository.findByParticipantId(participantId);
        if (!row || row.contestId !== contestId) return null;

        const answers = row.answers as unknown as Record<string, SavedAnswer>;
        const questionOrder = (row.questionOrder as unknown as string[] | null) ?? Object.keys(answers);

        const answersArray = questionOrder.map((questionId) => ({
            questionId,
            selectedOptionId: answers[questionId]?.selectedOptionId ?? null,
        }));

        return {
            organizationId: row.organizationId,
            answersArray,
            totalQuestions: row.totalQuestions,
            attempted: answersArray.filter((a) => a.selectedOptionId !== null).length,
            startedAt: row.startedAt ? row.startedAt.toISOString() : null,
            contestEndTime: row.contestEndTime ? row.contestEndTime.toISOString() : null,
        };
    }
}
