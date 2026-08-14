import { Job, UnrecoverableError } from "bullmq";
import { AuditTargetType } from "@prisma/client";
import { logAudit } from "./audit-log";

/**
 * Emits a distinct "retries exhausted" audit event when a BullMQ job fails
 * on its final attempt (job.attemptsMade has reached its configured max)
 * with an ordinary retryable error. Call from a worker's `.on("failed", ...)`
 * handler.
 *
 * Deliberately excludes UnrecoverableError — that's a permanent, structural
 * rejection thrown on purpose (bad payload, invalid state) that BullMQ never
 * retries in the first place, not a "we kept trying and ran out of
 * attempts" event. Workers that already mark their own DB row FAILED on
 * every attempt (e.g. certificate.worker.ts) keep doing that separately —
 * this only adds the one-time "exhausted" signal on top.
 */
export function auditIfRetriesExhausted(params: {
    queueName: string;
    job: Job | undefined;
    err: Error;
    targetType: AuditTargetType;
    targetId: string;
    targetLabel: string;
    organizationId?: string | undefined;
}): void {
    const { queueName, job, err, targetType, targetId, targetLabel, organizationId } = params;
    if (!job) return;
    if (err instanceof UnrecoverableError) return;

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;

    logAudit({
        action: "system.job_retries_exhausted",
        targetType,
        targetId,
        targetLabel,
        organizationId,
        actorType: "SYSTEM",
        metadata: { queue: queueName, jobId: job.id, attemptsMade: job.attemptsMade, maxAttempts, error: err.message },
    });
}
