// Single source of truth for the audit trail feature (retention sweep,
// metadata truncation). Deliberately NOT wired to process.env / .env* — this
// is an internal tuning knob, not something that needs to vary per
// deployment, matching the precedent set by config.payment.abandonedCloseAfterMs.
// Edit the values below to change behavior; nothing else needs to be touched.

export const auditLogConfig = {
  metadata: {
    // Audit entry `metadata` JSON is truncated above this many bytes at
    // write time (oversized payloads get `{ truncated: true, ... }`).
    maxBytes: 2048,
  },

  retention: {
    // Rows older than this are deleted by the retention sweep.
    maxAgeDays: 60,
    // How often the retention sweep runs.
    sweepIntervalMs: 24 * 60 * 60 * 1000, // daily
    // Rows deleted per DELETE statement — keeps each statement short instead
    // of one long-running lock on a table also being inserted into constantly.
    deleteBatchSize: 5_000,
  },
} as const;

export type AuditLogConfig = typeof auditLogConfig;
