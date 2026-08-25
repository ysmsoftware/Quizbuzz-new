// Internal tuning knobs for the job-checkpoint pipeline (see common/job-checkpoint.ts
// and common/checkpoint-drain.ts). Deliberately NOT wired to process.env / .env* —
// same precedent as audit-log.config.ts: these are internal constants that don't
// vary per deployment, not something ops needs to tune per-environment.
// Edit the values below to change behavior; nothing else needs to be touched.

export const checkpointConfig = {
    redis: {
        streamKey: "checkpoints:stream",

        // Proactive memory budget: ~5-10MB target, sized against a 500MB ElastiCache
        // instance that already runs ~350-400MB of live-quiz state (source of truth
        // during a contest — this stream must never compete with it for memory).
        // Redis Streams don't expose cheap per-write byte accounting, so this is
        // expressed as an entry count derived from the measured average entry size
        // (~150-250 bytes for this schema): 8MB target / ~200 bytes ≈ 40,000 entries.
        // Recalibrate if the entry shape changes materially — the drain worker can
        // sample `MEMORY USAGE` once per run (cheap at drain time, not per-write) as
        // a periodic sanity check against this estimate.
        softFlushEntryThreshold: 40_000,

        // Hard, data-loss-accepting safety net passed to XADD's own MAXLEN. Redis
        // auto-trims the OLDEST entries once this is reached — discarded before ever
        // being flushed. Only reachable if Postgres or the drain worker itself is
        // down long enough that BOTH the timer and the soft threshold above fail
        // repeatedly. Set well above the soft threshold so it's never the normal
        // flush path — same accepted tradeoff as auditLogConfig's Redis Stream.
        hardCapEntries: 150_000,
    },

    flush: {
        // Periodic trigger — whichever of this or redis.softFlushEntryThreshold
        // fires first wins. 10 min default; acceptable range for this data is 5-15 min.
        intervalMs: 10 * 60 * 1000,
        // Entries pulled per drain run / rows per bulk insert transaction — mirrors
        // auditLogConfig.retention.deleteBatchSize's reasoning (keeps each DB
        // statement short rather than one huge transaction).
        batchSize: 5_000,
    },

    retention: {
        // Shorter than the 60-day audit retention — this is high-volume operational
        // timing data, not a compliance trail.
        maxAgeDays: 14,
        sweepIntervalMs: 24 * 60 * 60 * 1000, // daily
        deleteBatchSize: 5_000,
    },
} as const;

export type CheckpointConfig = typeof checkpointConfig;
