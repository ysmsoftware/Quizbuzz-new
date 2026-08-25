import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { checkpointConfig } from "../config/checkpoint.config";
import { checkpointDrainQueue } from "../queues";
import { JOB_BOUNDARY_STAGE } from "./job-checkpoint";
import logger from "../config/logger";

interface ParsedEntry {
    streamId: string;
    id: string;
    jobId: string;
    queue: string;
    organizationId: string;
    contestId: string;
    requestId: string;
    entityType: string;
    entityId: string;
    stage: string;
    status: "OK" | "ERROR";
    startedAt: number;
    endedAt: number;
    durationMs: number;
    boundaryKind?: string | undefined;
    errorMessage?: string | undefined;
}

function parseEntry(streamId: string, fields: string[]): ParsedEntry {
    const map: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const value = fields[i + 1];
        if (key !== undefined && value !== undefined) map[key] = value;
    }
    return {
        streamId,
        id: map.id ?? streamId,
        jobId: map.jobId ?? "",
        queue: map.queue ?? "",
        organizationId: map.organizationId ?? "",
        contestId: map.contestId ?? "",
        requestId: map.requestId ?? "",
        entityType: map.entityType ?? "",
        entityId: map.entityId ?? "",
        stage: map.stage ?? "",
        status: map.status === "ERROR" ? "ERROR" : "OK",
        startedAt: Number(map.startedAt ?? 0),
        endedAt: Number(map.endedAt ?? 0),
        durationMs: Number(map.durationMs ?? 0),
        boundaryKind: map.boundaryKind,
        errorMessage: map.errorMessage,
    };
}

/**
 * One drain pass: pulls up to checkpointConfig.flush.batchSize entries off
 * the Redis stream, splits them into per-stage JobCheckpoint rows vs
 * job-boundary markers (see job-checkpoint.ts::recordJobBoundary), writes
 * both in a single Postgres transaction, then removes exactly the entries
 * that were successfully written.
 *
 * Deliberately XDEL by id, not a blind XTRIM — if the process dies between
 * the transaction committing and the XDEL running, the same entries get
 * re-processed on the next run. That's safe: JobCheckpoint's id is the
 * stable UUID generated at write time, so skipDuplicates makes the replay a
 * no-op instead of a duplicate row, and the ScheduledJob upsert is naturally
 * idempotent (same bullJobId, same computed fields).
 */
export async function runCheckpointDrain(): Promise<{ flushed: number }> {
    const raw = await redis.xrange(
        checkpointConfig.redis.streamKey,
        "-", "+",
        "COUNT", checkpointConfig.flush.batchSize
    );
    if (raw.length === 0) return { flushed: 0 };

    const entries = raw.map(([streamId, fields]) => parseEntry(streamId, fields));
    const stageEntries = entries.filter((e) => e.stage !== JOB_BOUNDARY_STAGE && e.jobId);
    const boundaryEntries = entries.filter((e) => e.stage === JOB_BOUNDARY_STAGE && e.jobId);

    const checkpointRows = stageEntries.map((e) => ({
        id: e.id,
        jobId: e.jobId,
        queue: e.queue,
        requestId: e.requestId || null,
        entityType: e.entityType || null,
        entityId: e.entityId || null,
        stage: e.stage,
        status: e.status,
        startedAt: new Date(e.startedAt),
        endedAt: new Date(e.endedAt),
        durationMs: e.durationMs,
    }));

    await prisma.$transaction(async (tx) => {
        if (checkpointRows.length > 0) {
            await tx.jobCheckpoint.createMany({ data: checkpointRows, skipDuplicates: true });
        }
        await applyJobBoundaries(tx, boundaryEntries);
    });

    const ids = entries.map((e) => e.streamId);
    await redis.xdel(checkpointConfig.redis.streamKey, ...ids);

    return { flushed: entries.length };
}

/**
 * Upserts ScheduledJob summary rows from this batch's STARTED/COMPLETED/
 * FAILED boundary markers — organizationId, queue-wait time (startedAt vs
 * ScheduledJob.createdAt on first insert), processing time, and terminal
 * status. A job with only a STARTED marker in this batch (still running)
 * gets an ACTIVE row; its COMPLETED/FAILED marker arrives in a later batch
 * and updates the same row via the bullJobId unique key.
 */
async function applyJobBoundaries(tx: Prisma.TransactionClient, boundaries: ParsedEntry[]): Promise<void> {
    const byJob = new Map<string, ParsedEntry[]>();
    for (const b of boundaries) {
        if (!b.organizationId) {
            logger.warn(
                `[checkpoint-drain] Skipping ScheduledJob summary for job ${b.jobId} — no organizationId on the checkpoint (organizationId is a required field on ScheduledJob).`
            );
            continue;
        }
        const list = byJob.get(b.jobId) ?? [];
        list.push(b);
        byJob.set(b.jobId, list);
    }

    for (const [jobId, list] of byJob) {
        list.sort((a, b) => a.startedAt - b.startedAt);
        const started = list.find((e) => e.boundaryKind === "STARTED");
        const terminal = [...list].reverse().find((e) => e.boundaryKind === "COMPLETED" || e.boundaryKind === "FAILED");
        const any = list[0];
        if (!any) continue;

        const payload: Prisma.InputJsonValue = {
            ...(any.entityType ? { entityType: any.entityType } : {}),
            ...(any.entityId ? { entityId: any.entityId } : {}),
        };

        const createData: Prisma.ScheduledJobCreateInput = {
            organization: { connect: { id: any.organizationId } },
            ...(any.contestId ? { contest: { connect: { id: any.contestId } } } : {}),
            bullJobId: jobId,
            queue: any.queue,
            name: any.entityType ? `${any.queue}:${any.entityType}` : any.queue,
            payload,
            status: "ACTIVE",
            ...(started ? { startedAt: new Date(started.startedAt) } : {}),
        };

        const updateData: Prisma.ScheduledJobUpdateInput = {
            ...(started ? { startedAt: new Date(started.startedAt) } : {}),
        };

        if (terminal) {
            if (terminal.boundaryKind === "COMPLETED") {
                createData.status = "COMPLETED";
                createData.completedAt = new Date(terminal.endedAt);
                updateData.status = "COMPLETED";
                updateData.completedAt = new Date(terminal.endedAt);
            } else {
                createData.status = "FAILED";
                createData.failedAt = new Date(terminal.endedAt);
                updateData.status = "FAILED";
                updateData.failedAt = new Date(terminal.endedAt);
                if (terminal.errorMessage) {
                    createData.error = terminal.errorMessage;
                    updateData.error = terminal.errorMessage;
                }
            }
        }

        await tx.scheduledJob.upsert({
            where: { bullJobId: jobId },
            create: createData,
            update: updateData,
        });
    }
}

/** Schedules (or re-schedules) the recurring drain — same pattern as
 * ensureAuditRetentionSweepJob(). This is the timer half of the two flush
 * triggers; the size-triggered half lives in job-checkpoint.ts. Both point
 * at the same job name/processor — checkpoint-drain.worker.ts runs with
 * concurrency: 1 so the two triggers can never race. */
export async function ensureCheckpointDrainJob(): Promise<void> {
    const jobId = "periodic-checkpoint-drain";
    const repeatables = await checkpointDrainQueue.getRepeatableJobs();
    const existing = repeatables.find((repeatable) => repeatable.id === jobId);
    if (existing) {
        await checkpointDrainQueue.removeRepeatableByKey(existing.key);
    }
    await checkpointDrainQueue.add(
        "drain-checkpoints",
        {},
        {
            jobId,
            repeat: { every: checkpointConfig.flush.intervalMs },
            removeOnComplete: true,
            removeOnFail: true,
        }
    );
    logger.info(
        `[checkpoint-drain] Recurring drain scheduled every ${checkpointConfig.flush.intervalMs / 60_000}min, plus on-demand at ${checkpointConfig.redis.softFlushEntryThreshold} entries`
    );
}

/**
 * Deletes job_checkpoints rows (and terminal scheduled_jobs rows) older than
 * checkpointConfig.retention.maxAgeDays, in small batches — same reasoning
 * as runAuditRetentionSweep(): never one long-running lock on a table this
 * app writes to constantly.
 */
export async function runCheckpointRetentionSweep(): Promise<{ deletedCheckpoints: number; deletedJobs: number }> {
    const cutoff = new Date(Date.now() - checkpointConfig.retention.maxAgeDays * 24 * 60 * 60 * 1000);
    let deletedCheckpoints = 0;
    let deletedJobs = 0;

    while (true) {
        const rows = await prisma.jobCheckpoint.findMany({
            where: { createdAt: { lt: cutoff } },
            select: { id: true },
            take: checkpointConfig.retention.deleteBatchSize,
        });
        if (rows.length === 0) break;
        await prisma.jobCheckpoint.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
        deletedCheckpoints += rows.length;
        if (rows.length < checkpointConfig.retention.deleteBatchSize) break;
    }

    while (true) {
        const rows = await prisma.scheduledJob.findMany({
            where: {
                createdAt: { lt: cutoff },
                status: { in: ["COMPLETED", "FAILED"] },
            },
            select: { id: true },
            take: checkpointConfig.retention.deleteBatchSize,
        });
        if (rows.length === 0) break;
        await prisma.scheduledJob.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
        deletedJobs += rows.length;
        if (rows.length < checkpointConfig.retention.deleteBatchSize) break;
    }

    return { deletedCheckpoints, deletedJobs };
}

export async function ensureCheckpointRetentionSweepJob(): Promise<void> {
    const jobId = "periodic-checkpoint-retention-sweep";
    const repeatables = await checkpointDrainQueue.getRepeatableJobs();
    const existing = repeatables.find((repeatable) => repeatable.id === jobId);
    if (existing) {
        await checkpointDrainQueue.removeRepeatableByKey(existing.key);
    }
    await checkpointDrainQueue.add(
        "sweep-checkpoint-retention",
        {},
        {
            jobId,
            repeat: { every: checkpointConfig.retention.sweepIntervalMs },
            removeOnComplete: true,
            removeOnFail: true,
        }
    );
}
