import { prisma } from "../config/db";
import { auditLogConfig } from "../config/audit-log.config";
import { auditRetentionQueue } from "../queues";
import logger from "../config/logger";

/**
 * Deletes audit_logs rows older than auditLogConfig.retention.maxAgeDays, in
 * batches of auditLogConfig.retention.deleteBatchSize — repeats until a batch
 * comes back empty rather than issuing one unbounded DELETE, so the sweep
 * never holds a long lock on a table the app writes to constantly.
 */
export async function runAuditRetentionSweep(): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - auditLogConfig.retention.maxAgeDays * 24 * 60 * 60 * 1000);
    let deleted = 0;

    while (true) {
        const rows = await prisma.auditLog.findMany({
            where: { createdAt: { lt: cutoff } },
            select: { id: true },
            take: auditLogConfig.retention.deleteBatchSize,
        });
        if (rows.length === 0) break;

        await prisma.auditLog.deleteMany({
            where: { id: { in: rows.map((r) => r.id) } },
        });
        deleted += rows.length;

        if (rows.length < auditLogConfig.retention.deleteBatchSize) break;
    }

    return { deleted };
}

/** Schedules (or re-schedules) the recurring sweep — same pattern as
 * ContestService.ensureContestStartReconciliationJob / PaymentService.ensurePaymentCleanupRecurringJob. */
export async function ensureAuditRetentionSweepJob(): Promise<void> {
    const jobId = "periodic-audit-retention-sweep";
    const repeatables = await auditRetentionQueue.getRepeatableJobs();
    const existing = repeatables.find((repeatable) => repeatable.id === jobId);
    if (existing) {
        await auditRetentionQueue.removeRepeatableByKey(existing.key);
    }
    await auditRetentionQueue.add(
        "sweep-audit-retention",
        {},
        {
            jobId,
            repeat: { every: auditLogConfig.retention.sweepIntervalMs },
            removeOnComplete: true,
            removeOnFail: true,
        },
    );
    logger.info(
        `[audit-retention] Recurring sweep scheduled every ${auditLogConfig.retention.sweepIntervalMs / (60 * 60 * 1000)}h, maxAgeDays=${auditLogConfig.retention.maxAgeDays}`
    );
}
