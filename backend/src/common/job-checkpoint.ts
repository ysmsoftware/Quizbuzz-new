import { randomUUID } from "node:crypto";
import { redis } from "../config/redis";
import { checkpointConfig } from "../config/checkpoint.config";
import { checkpointDrainQueue } from "../queues";
import { getAuditContext } from "./audit-context";
import logger from "../config/logger";

export interface CheckpointMeta {
    jobId: string;
    queue: string;
    /**
     * Required for the ScheduledJob summary row (organizationId is a
     * non-nullable FK on that model) — pass it whenever the job payload has
     * one. If omitted, per-stage JobCheckpoint rows are still recorded fine;
     * only the ScheduledJob (total/queue-wait time) summary is skipped for
     * that job, logged once by the drain worker.
     */
    organizationId?: string | undefined;
    contestId?: string | undefined;
    entityType?: string | undefined;
    entityId?: string | undefined;
}

/**
 * Times one stage of a job and records it to Redis — never Postgres, never
 * awaited by the caller in a way that could slow the actual work down.
 * Fire-and-forget + never-throwing, same contract as logAudit(). Records on
 * both success AND failure (status field), then rethrows the original error
 * so the worker's existing retry/failure handling is untouched.
 *
 * Usage:
 *   const html = await withCheckpoint(meta, "render_html", () => renderCertificateHtml(...));
 */
export async function withCheckpoint<T>(
    meta: CheckpointMeta,
    stage: string,
    fn: () => Promise<T>
): Promise<T> {
    const startedAt = Date.now();
    try {
        const result = await fn();
        recordCheckpoint(meta, stage, startedAt, Date.now(), "OK");
        return result;
    } catch (err) {
        recordCheckpoint(meta, stage, startedAt, Date.now(), "ERROR");
        throw err;
    }
}

/**
 * Marks a job's overall start or terminal outcome — an explicit signal from
 * the worker (which is the only thing that actually knows when ITS work is
 * truly done), rather than the drain worker trying to infer "was that the
 * last stage?" from an arbitrary sequence of per-stage checkpoints. Recorded
 * on the same stream, using a reserved stage name the drain worker treats
 * specially: it updates ScheduledJob's startedAt/completedAt/failedAt
 * instead of inserting a JobCheckpoint row. Call once at the very start of a
 * job (kind: "STARTED") and once at the very end (kind: "COMPLETED" |
 * "FAILED") — see certificate.worker.ts for the call sites.
 */
export function recordJobBoundary(
    meta: CheckpointMeta,
    kind: "STARTED" | "COMPLETED" | "FAILED",
    errorMessage?: string
): void {
    const now = Date.now();
    recordCheckpoint(meta, JOB_BOUNDARY_STAGE, now, now, kind === "FAILED" ? "ERROR" : "OK", {
        boundaryKind: kind,
        ...(errorMessage ? { errorMessage: errorMessage.slice(0, 500) } : {}),
    });
}

export const JOB_BOUNDARY_STAGE = "__job_boundary";

/**
 * Records one checkpoint entry to the Redis stream. Never awaited by
 * withCheckpoint — fire-and-forget, wrapped so a Redis hiccup here can never
 * throw into the caller's actual job processing.
 */
function recordCheckpoint(
    meta: CheckpointMeta,
    stage: string,
    startedAt: number,
    endedAt: number,
    status: "OK" | "ERROR",
    extra?: Record<string, string>
): void {
    const entry: Record<string, string> = {
        id: randomUUID(),                              // idempotency key — generated here, not at flush time
        jobId: meta.jobId,
        queue: meta.queue,
        organizationId: meta.organizationId ?? "",
        contestId: meta.contestId ?? "",
        requestId: getAuditContext().requestId ?? "",
        entityType: meta.entityType ?? "",
        entityId: meta.entityId ?? "",
        stage,
        status,
        startedAt: String(startedAt),
        endedAt: String(endedAt),
        durationMs: String(endedAt - startedAt),
        ...extra,
    };

    // XADD + XLEN in one round trip. MAXLEN here is the HARD, data-loss-accepting
    // safety net only (Redis silently drops the oldest entries past this point) —
    // deliberately set well above the soft threshold checked below, so under
    // normal operation it is never actually reached.
    const pipeline = redis.pipeline();
    pipeline.xadd(
        checkpointConfig.redis.streamKey,
        "MAXLEN", "~", String(checkpointConfig.redis.hardCapEntries),
        "*",
        ...Object.entries(entry).flat()
    );
    pipeline.xlen(checkpointConfig.redis.streamKey);

    pipeline
        .exec()
        .then((results) => {
            const streamLength = results?.[1]?.[1] as number | undefined;
            // Proactive size trigger — the actual ~5-10MB memory budget. Crossing
            // this nudges the drain worker to run now rather than waiting for the
            // next timer tick, so we never rely on the destructive hard cap above.
            if (typeof streamLength === "number" && streamLength >= checkpointConfig.redis.softFlushEntryThreshold) {
                triggerOnDemandDrain();
            }
        })
        .catch((err) => {
            logger.warn(`[job-checkpoint] Failed to record checkpoint "${stage}" for job ${meta.jobId}: ${(err as Error).message}`);
        });
}

/**
 * Nudges the drain worker to run now instead of waiting for the next timer
 * tick. Fire-and-forget, deduped by a fixed BullMQ jobId — a burst of
 * checkpoints crossing the threshold in the same second collapses into one
 * drain request, not one per checkpoint (same no-op-if-exists dedup behavior
 * certificate.service.ts already relies on via its own jobId key).
 */
function triggerOnDemandDrain(): void {
    checkpointDrainQueue
        .add("drain-checkpoints", {}, { jobId: "on-demand-checkpoint-drain", removeOnComplete: true, removeOnFail: true })
        .catch((err) => {
            logger.warn(`[job-checkpoint] Failed to trigger on-demand drain: ${(err as Error).message}`);
        });
}
