import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// In test runs (Jest sets NODE_ENV=test by default, and CI passes it
// explicitly), load the committed .env.test file instead of the local,
// git-ignored .env. This keeps unit tests config-driven without requiring
// real secrets in CI, and keeps the schema itself the single source of
// truth for what "valid config" means — no test-only bypass of validation.
dotenv.config({
    path: path.resolve(
        __dirname,
        "../../",
        process.env.NODE_ENV === "test" ? ".env.test" : ".env"
    ),
});

/**
 * ----------------------------------------
 * ENV VALIDATION SCHEMA
 * ----------------------------------------
 */

const envSchema = z.object({
    // APP
    NODE_ENV: z.enum(["development", "staging", "production", "test"]),
    APP_NAME: z.string(),
    PORT: z.coerce.number().default(3000),
    BASE_URL: z.string().url(),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),

    INSTANCE_ID: z.string(),
    INSTANCE_COUNT: z.coerce.number().default(1),

    // LOCALIZATION — fallback IANA timezone used to format any date shown to a user
    // (emails, certificates, exports) when the organization hasn't set its own via
    // OrganizationProfile.timezone (captured from the browser at onboarding). Never
    // read implicitly from the server process's local time: that's whatever the OS
    // happens to default to (UTC on a fresh AWS instance, something else on a dev
    // machine), and would silently drift per-instance under auto-scaling.
    DEFAULT_TIMEZONE: z.string().default("Asia/Kolkata"),

    // OPS & BILLING HANDOFF
    BILLING_HANDOFF_SECRET: z.string().default("billing_handoff_secret_shared_key_998877"),
    OPS_BASE_URL: z.string().default("http://localhost:3010"),

    // DATABASE
    DATABASE_URL: z.string().url(),
    DB_POOL_MIN: z.coerce.number().default(5),
    DB_POOL_MAX: z.coerce.number().default(20),
    DB_QUERY_TIMEOUT: z.coerce.number().default(5000),
    // Explicit transaction-level bounds (distinct from DB_QUERY_TIMEOUT, which
    // actually controls pg.Pool's idleTimeoutMillis — see config/db.ts). Sized
    // generously above Prisma's interactive-transaction defaults (maxWait 2000ms,
    // timeout 5000ms) so a legitimate DB pool burst doesn't false-fail a submission.
    DB_TRANSACTION_MAX_WAIT_MS: z.coerce.number().default(5000),
    DB_TRANSACTION_TIMEOUT_MS: z.coerce.number().default(10000),

    // REDIS
    REDIS_HOST: z.string(),
    REDIS_PORT: z.coerce.number(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().default(0),

    REDIS_MAX_RETRIES: z.coerce.number().default(5),
    REDIS_CONNECT_TIMEOUT: z.coerce.number().default(10000),
    REDIS_COMMAND_TIMEOUT: z.coerce.number().default(5000),

    REDIS_CLUSTER_ENABLED: z.coerce.boolean().default(false),
    REDIS_CLUSTER_NODES: z.string().optional(),

    // REDIS TTLs
    QUIZ_SESSION_TTL: z.coerce.number(),
    HEARTBEAT_TTL: z.coerce.number(),
    SOCKET_TOKEN_TTL: z.coerce.number(),
    OTP_TTL: z.coerce.number(),
    IDEMPOTENCY_TTL: z.coerce.number(),

    // WEBSOCKET
    WS_NAMESPACE: z.string(),
    WS_PATH: z.string(),
    WS_HEARTBEAT_INTERVAL: z.coerce.number(),
    WS_CONNECTION_TIMEOUT: z.coerce.number(),
    WS_MAX_CONNECTIONS_PER_INSTANCE: z.coerce.number(),

    WS_RECONNECT_ATTEMPTS: z.coerce.number().default(5),
    WS_RECONNECT_DELAY: z.coerce.number().default(2000),

    // AUTH
    JWT_ACCESS_SECRET: z.string().min(10),
    JWT_REFRESH_SECRET: z.string().min(10),
    JWT_CONTACT_SECRET: z.string().min(10),

    JWT_ACCESS_TTL: z.coerce.number(),
    JWT_REFRESH_TTL: z.coerce.number(),
    JWT_CONTACT_TTL: z.coerce.number(),

    COOKIE_DOMAIN: z.string(),
    COOKIE_SECURE: z.coerce.boolean(),
    COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]),

    // OTP
    OTP_LENGTH: z.coerce.number().default(6),
    OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
    OTP_RATE_LIMIT: z.coerce.number().default(5),
    OTP_SECRET: z.coerce.string().min(10),

    // RATE LIMIT
    RATE_LIMIT_WINDOW: z.coerce.number(),
    RATE_LIMIT_MAX: z.coerce.number(),

    RATE_LIMIT_LOGIN: z.coerce.number(),
    RATE_LIMIT_REGISTER: z.coerce.number(),
    RATE_LIMIT_OTP: z.coerce.number(),

    // QUEUE
    QUEUE_REDIS_DB: z.coerce.number(),
    QUEUE_PREFIX: z.string(),

    QUEUE_CONCURRENCY: z.coerce.number(),
    QUEUE_RETRY_ATTEMPTS: z.coerce.number(),
    QUEUE_BACKOFF_TYPE: z.enum(["fixed", "exponential"]),
    QUEUE_BACKOFF_DELAY: z.coerce.number(),

    WORKER_INSTANCES: z.coerce.number(),

    // PAYMENT
    RAZORPAY_KEY_ID: z.string(),
    RAZORPAY_KEY_SECRET: z.string(),
    RAZORPAY_WEBHOOK_SECRET: z.string(),
    PAYMENT_CURRENCY: z.string().default("INR"),
    PAYMENT_ORDER_REUSE_WINDOW_MS: z.coerce.number().min(0).default(10 * 60 * 1000),
    RAZORPAY_ROUTE_ENABLED: z.coerce.boolean().default(false),
    RAZORPAY_ROUTE_ONBOARDING_MODE: z.enum(["MANUAL", "API"]).default("MANUAL"),
    PLATFORM_COMMISSION_PERCENT: z.coerce.number().min(0).max(100).default(2),
    RAZORPAY_GATEWAY_FEE_PERCENT: z.coerce.number().min(0).max(100).default(2),
    RAZORPAY_GST_ON_FEE_PERCENT: z.coerce.number().min(0).max(100).default(18),
    RAZORPAY_ROUTE_TRANSFER_DELAY_MS: z.coerce.number().min(0).default(5 * 60 * 1000),
    PAYOUT_MAX_PAGE_SIZE: z.coerce.number().int().min(1).default(100),
    PAYOUT_STUCK_TRANSFER_RESUME_AFTER_MS: z.coerce.number().min(0).default(3 * 60 * 1000),
    PAYOUT_RECONCILIATION_INTERVAL_MINUTES: z.coerce.number().min(1).default(15),
    PAYOUT_RECONCILIATION_GRACE_PERIOD_MS: z.coerce.number().min(0).default(10 * 60 * 1000),

    // MESSAGING
    SMTP_HOST: z.string(),
    SMTP_PORT: z.coerce.number(),
    SMTP_USER: z.string(),
    SMTP_PASS: z.string(),
    EMAIL_FROM: z.string().email(),

    AISENSY_API_URL: z.string(),
    AISENSY_API_KEY: z.string(),

    // FEATURE FLAGS
    ENABLE_PROCTORING: z.coerce.boolean().default(false),
    ENABLE_ANALYTICS: z.coerce.boolean().default(true),
    ENABLE_CERTIFICATES: z.coerce.boolean().default(true),
    ENABLE_NOTIFICATIONS: z.coerce.boolean().default(true),

    // ANALYTICS
    ANALYTICS_SNAPSHOT_INTERVAL: z.coerce.number(),
    ANALYTICS_RETENTION_DAYS: z.coerce.number(),

    // DURABILITY — periodic Redis→DB progress snapshot + recovery
    DURABILITY_SNAPSHOT_INTERVAL_MINUTES: z.coerce.number().default(5),
    DURABILITY_SNAPSHOT_BATCH_SIZE: z.coerce.number().default(300),
    DURABILITY_SNAPSHOT_BATCH_CONCURRENCY: z.coerce.number().default(4),

    // ORG DASHBOARD
    // All limits below are ceilings + defaults for the /org/:orgId/dashboard/* endpoints.
    // Callers can request anything from 1 up to the *_MAX value via query params —
    // nothing here is a hardcoded response size, it's just the config-driven bound.
    DASHBOARD_UPCOMING_CONTESTS_LIMIT_DEFAULT: z.coerce.number().int().min(1).default(5),
    DASHBOARD_UPCOMING_CONTESTS_LIMIT_MAX: z.coerce.number().int().min(1).default(50),
    DASHBOARD_RECENT_REGISTRATIONS_LIMIT_DEFAULT: z.coerce.number().int().min(1).default(10),
    DASHBOARD_RECENT_REGISTRATIONS_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
    DASHBOARD_TREND_DAYS_DEFAULT: z.coerce.number().int().min(1).default(7),
    DASHBOARD_TREND_DAYS_MAX: z.coerce.number().int().min(1).default(90),
    DASHBOARD_DEFAULT_PERIOD: z.enum(["week", "month"]).default("month"),
    // Overview aggregates across every contest in the org, so it's cached briefly in
    // Redis rather than recomputed on every poll (Redis rule 5.1 — allowed as "live
    // analytics", not persisted/critical data).
    DASHBOARD_OVERVIEW_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(10),

    // PUB/SUB
    REDIS_PUBSUB_ENABLED: z.coerce.boolean(),
    REDIS_PUBSUB_PREFIX: z.string(),

    // LIMITS
    MAX_PARTICIPANTS_PER_CONTEST: z.coerce.number(),
    MAX_QUESTIONS_PER_CONTEST: z.coerce.number(),
    MAX_CONCURRENT_CONTESTS: z.coerce.number(),

    // SECURITY
    BCRYPT_SALT_ROUNDS: z.coerce.number(),
    CORS_ALLOWED_ORIGINS: z.string(),
    CORS_ALLOWED_METHODS: z.string(),
    CORS_ALLOW_CREDENTIALS: z.coerce.boolean(),

    // IDEMPOTENCY
    IDEMPOTENCY_ENABLED: z.coerce.boolean(),

    // STORAGE
    STORAGE_PROVIDER: z.enum(["s3", "local"]),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),

    // PROCTORING
    PROCTORING_EVENT_THRESHOLD: z.coerce.number(),
    PROCTORING_STRICT_MODE: z.coerce.boolean(),

    // HEALTH
    HEALTHCHECK_ENABLED: z.coerce.boolean(),
    METRICS_ENABLED: z.coerce.boolean(),

    // LOGGING
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
    LOG_FORMAT: z.enum(["json", "pretty"]),

    // DEBUG
    ENABLE_DEBUG_LOGS: z.coerce.boolean(),
    MOCK_PAYMENT: z.coerce.boolean(),

    // TIMEOUTS
    API_TIMEOUT: z.coerce.number(),
    DB_TIMEOUT: z.coerce.number(),
    REDIS_TIMEOUT: z.coerce.number(),

    // QUIZ CONTROL
    QUIZ_AUTO_SUBMIT: z.coerce.boolean(),
    QUIZ_TIME_WARNING_1: z.coerce.number(),
    QUIZ_TIME_WARNING_2: z.coerce.number(),
    QUIZ_TIME_WARNING_3: z.coerce.number(),
    // How early (seconds) a lifecycle timer job may fire relative to the contest's
    // CURRENT startTime/endTime before it is treated as stale and re-scheduled.
    // Absorbs BullMQ delay jitter + minor clock skew between app instances.
    QUIZ_TIMER_DRIFT_TOLERANCE: z.coerce.number().default(5),
    // Grace period (seconds) after a contest ends before participants who never
    // joined are marked ABSENT — lets submission workers flush and persist first.
    QUIZ_MARK_ABSENT_DELAY: z.coerce.number().default(600),
    // How far before startTime the admin "Start Now" override becomes visible.
    QUIZ_MANUAL_START_VISIBILITY_WINDOW: z.coerce.number().default(600), // 10 min
    // Reconciliation sweep (contest-start-reliability spec, Phase 2): how often the
    // recurring job scans for contests whose CONTEST_START job should exist but
    // doesn't, and how far ahead it looks when deciding what counts as a candidate.
    QUIZ_RECONCILIATION_INTERVAL_MS: z.coerce.number().default(15 * 60 * 1000), // 15 min
    QUIZ_RECONCILIATION_LOOKAHEAD_MS: z.coerce.number().default(30 * 60 * 1000), // 2x interval
    QUIZ_RECONCILIATION_GRACE_MS: z.coerce.number().default(5 * 60 * 1000), // catch recently-due misses too
    // Redis lock (`lock:submission:{cid}:{pid}`) TTL guarding submitQuiz() against
    // duplicate/concurrent submissions — safety net if a worker crashes mid-submit
    // without hitting the lock's `finally` release.
    QUIZ_SUBMISSION_LOCK_TTL_MS: z.coerce.number().default(15000),
    // 15-minute start-time grid (contest-start-reliability spec §6.4).
    CONTEST_START_TIME_SLOT_MINUTES: z.coerce.number().default(15),
    MAX_SLUG_RETRIES: z.coerce.number().default(5),
    JOIN_CODE_LENGTH: z.coerce.number().default(6),
    BULK_IMPORT_LIMIT: z.coerce.number().default(500),

    // PUPPETEER
    PUPPETEER_EXECUTABLE_PATH: z.string().optional(),

    // SENTRY
    SENTRY_DSN: z.string().url().optional(),
    APP_VERSION: z.string().default("local"),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
    SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

    // POSTHOG
    POSTHOG_API_KEY: z.string().min(1),
    POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
    POSTHOG_FLUSH_AT: z.coerce.number().default(20),
    POSTHOG_FLUSH_INTERVAL: z.coerce.number().default(30000),
});

// PARSE ENV

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsedEnv.error.format());
    process.exit(1);
}

const env = parsedEnv.data;

// STRUCTURED CONFIG EXPORT

export const config = {
    app: {
        nodeEnv: env.NODE_ENV,
        name: env.APP_NAME,
        port: env.PORT,
        baseUrl: env.BASE_URL,
        frontendUrl: env.FRONTEND_URL,
        instanceId: env.INSTANCE_ID,
        instanceCount: env.INSTANCE_COUNT,
        maxSlugRetries: env.MAX_SLUG_RETRIES,
        joinCodeLength: env.JOIN_CODE_LENGTH,
        defaultTimezone: env.DEFAULT_TIMEZONE,
    },

    billing: {
        handoffSecret: env.BILLING_HANDOFF_SECRET,
        opsBaseUrl: env.OPS_BASE_URL,
    },

    database: {
        url: env.DATABASE_URL,
        pool: {
            min: env.DB_POOL_MIN,
            max: env.DB_POOL_MAX,
        },
        timeout: env.DB_QUERY_TIMEOUT,
        transactionMaxWaitMs: env.DB_TRANSACTION_MAX_WAIT_MS,
        transactionTimeoutMs: env.DB_TRANSACTION_TIMEOUT_MS,
    },

    redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        db: env.REDIS_DB,
        maxRetries: env.REDIS_MAX_RETRIES,
        connectTimeout: env.REDIS_CONNECT_TIMEOUT,
        commandTimeout: env.REDIS_COMMAND_TIMEOUT,
        cluster: {
            enabled: env.REDIS_CLUSTER_ENABLED,
            nodes: env.REDIS_CLUSTER_NODES?.split(",") || [],
        },
        ttl: {
            quizSession: env.QUIZ_SESSION_TTL,
            heartbeat: env.HEARTBEAT_TTL,
            socketToken: env.SOCKET_TOKEN_TTL,
            otp: env.OTP_TTL,
            idempotency: env.IDEMPOTENCY_TTL,
        }
    },

    websocket: {
        namespace: env.WS_NAMESPACE,
        path: env.WS_PATH,
        heartbeatInterval: env.WS_HEARTBEAT_INTERVAL,
        maxConnections: env.WS_MAX_CONNECTIONS_PER_INSTANCE,
        connectionTimeout: env.WS_CONNECTION_TIMEOUT,
        reconnect: {
            attempts: env.WS_RECONNECT_ATTEMPTS,
            delay: env.WS_RECONNECT_DELAY,
        },
    },

    auth: {
        jwt: {
            accessSecret: env.JWT_ACCESS_SECRET,
            refreshSecret: env.JWT_REFRESH_SECRET,
            contactSecret: env.JWT_CONTACT_SECRET,
            accessTtl: env.JWT_ACCESS_TTL,
            refreshTtl: env.JWT_REFRESH_TTL,
            contactTtl: env.JWT_CONTACT_TTL,
        },
        cookie: {
            domain: env.COOKIE_DOMAIN,
            secure: env.COOKIE_SECURE,
            sameSite: env.COOKIE_SAME_SITE,
        },
        bcrypt: {
            saltRounds: env.BCRYPT_SALT_ROUNDS,
        },
        otp: {
            length: env.OTP_LENGTH,
            maxAttempts: env.OTP_MAX_ATTEMPTS,
            rateLimit: env.OTP_RATE_LIMIT,
            secret: env.OTP_SECRET,
        },
    },
    cors: {
        allowedOrigins: env.CORS_ALLOWED_ORIGINS.split(','),
        allowedMethods: env.CORS_ALLOWED_METHODS.split(','),
        allowedCredentials: env.CORS_ALLOW_CREDENTIALS,
    },

    queue: {
        redisDb: env.QUEUE_REDIS_DB,
        prefix: env.QUEUE_PREFIX,
        concurrency: env.QUEUE_CONCURRENCY,
        retryAttempts: env.QUEUE_RETRY_ATTEMPTS,
        backoff: {
            type: env.QUEUE_BACKOFF_TYPE,
            delay: env.QUEUE_BACKOFF_DELAY,
        },
        workerInstances: env.WORKER_INSTANCES,
    },

    rateLimit: {
        window: env.RATE_LIMIT_WINDOW,
        max: env.RATE_LIMIT_MAX,
        login: env.RATE_LIMIT_LOGIN,
        register: env.RATE_LIMIT_REGISTER,
        otp: env.RATE_LIMIT_OTP,
    },

    payment: {
        razorpay: {
            keyId: env.RAZORPAY_KEY_ID,
            keySecret: env.RAZORPAY_KEY_SECRET,
            webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
        },
        currency: env.PAYMENT_CURRENCY,
        orderReuseWindowMs: env.PAYMENT_ORDER_REUSE_WINDOW_MS,

        // Deliberately NOT env-driven — this is an internal cleanup cadence, not
        // something that needs to vary per deployment, so it's set globally here
        // instead of growing the env schema for a small housekeeping knob.
        // A Payment still PENDING/CREATED this long after its last update (i.e. no
        // webhook confirmation, no retry, nobody came back) is treated as abandoned
        // and closed out to FAILED by the periodic sweep — see payment-cleanup.worker.ts.
        abandonedCloseAfterMs: 24 * 60 * 60 * 1000, // 24 hours
        // How often the sweep itself runs. Hourly is frequent enough given the
        // 24h threshold above — worst case something sits FAILED-eligible for up
        // to an hour past the mark before the sweep catches it.
        abandonedSweepIntervalMs: 60 * 60 * 1000, // 1 hour
    },

    payout: {
        enabled: env.RAZORPAY_ROUTE_ENABLED,
        onboardingMode: env.RAZORPAY_ROUTE_ONBOARDING_MODE,
        commissionPercent: env.PLATFORM_COMMISSION_PERCENT,
        gatewayFeePercent: env.RAZORPAY_GATEWAY_FEE_PERCENT,
        gstOnFeePercent: env.RAZORPAY_GST_ON_FEE_PERCENT,
        transferDelayMs: env.RAZORPAY_ROUTE_TRANSFER_DELAY_MS,
        maxPageSize: env.PAYOUT_MAX_PAGE_SIZE,
        stuckTransferResumeAfterMs: env.PAYOUT_STUCK_TRANSFER_RESUME_AFTER_MS,
        reconciliationIntervalMinutes: env.PAYOUT_RECONCILIATION_INTERVAL_MINUTES,
        reconciliationGracePeriodMs: env.PAYOUT_RECONCILIATION_GRACE_PERIOD_MS,
    },

    messaging: {
        smtp: {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
            from: env.EMAIL_FROM,
        },
        whatsapp: {
            url: env.AISENSY_API_URL,
            apiKey: env.AISENSY_API_KEY,
        }
    },
    analytics: {
        snapshotInterval: env.ANALYTICS_SNAPSHOT_INTERVAL,
        retentionDays: env.ANALYTICS_RETENTION_DAYS,
    },

    durability: {
        snapshotIntervalMinutes: env.DURABILITY_SNAPSHOT_INTERVAL_MINUTES,
        snapshotBatchSize: env.DURABILITY_SNAPSHOT_BATCH_SIZE,
        snapshotBatchConcurrency: env.DURABILITY_SNAPSHOT_BATCH_CONCURRENCY,
    },

    dashboard: {
        upcomingContests: {
            defaultLimit: env.DASHBOARD_UPCOMING_CONTESTS_LIMIT_DEFAULT,
            maxLimit: env.DASHBOARD_UPCOMING_CONTESTS_LIMIT_MAX,
        },
        recentRegistrations: {
            defaultLimit: env.DASHBOARD_RECENT_REGISTRATIONS_LIMIT_DEFAULT,
            maxLimit: env.DASHBOARD_RECENT_REGISTRATIONS_LIMIT_MAX,
        },
        trend: {
            defaultDays: env.DASHBOARD_TREND_DAYS_DEFAULT,
            maxDays: env.DASHBOARD_TREND_DAYS_MAX,
        },
        defaultPeriod: env.DASHBOARD_DEFAULT_PERIOD,
        overviewCacheTtlSeconds: env.DASHBOARD_OVERVIEW_CACHE_TTL_SECONDS,
    },

    pubsub: {
        enabled: env.REDIS_PUBSUB_ENABLED,
        prefix: env.REDIS_PUBSUB_PREFIX,
    },

    limits: {
        maxParticipantsPerContest: env.MAX_PARTICIPANTS_PER_CONTEST,
        maxQuestionsPerContest: env.MAX_QUESTIONS_PER_CONTEST,
        maxConcurrentContests: env.MAX_CONCURRENT_CONTESTS,
    },

    storage: {
        provider: env.STORAGE_PROVIDER,
        s3: {
            bucket: env.S3_BUCKET,
            region: env.S3_REGION,
            accessKeyId: env.S3_ACCESS_KEY,
            secretKey: env.S3_SECRET_KEY,
        },
    },

    proctoring: {
        threshold: env.PROCTORING_EVENT_THRESHOLD,
        strictMode: env.PROCTORING_STRICT_MODE,
    },

    observability: {
        healthcheck: env.HEALTHCHECK_ENABLED,
        metrics: env.METRICS_ENABLED,
        logging: {
            level: env.LOG_LEVEL,
            format: env.LOG_FORMAT,
        },
    },

    debug: {
        enableDebugLogs: env.ENABLE_DEBUG_LOGS,
        mockPayment: env.MOCK_PAYMENT,
    },

    timeouts: {
        api: env.API_TIMEOUT,
        db: env.DB_TIMEOUT,
        redis: env.REDIS_TIMEOUT,
    },

    quiz: {
        autoSubmit: env.QUIZ_AUTO_SUBMIT,
        timeWarning1: env.QUIZ_TIME_WARNING_1,
        timeWarning2: env.QUIZ_TIME_WARNING_2,
        timeWarning3: env.QUIZ_TIME_WARNING_3,
        sessionTTL: env.QUIZ_SESSION_TTL,
        heartbeatTTL: env.HEARTBEAT_TTL,
        timerDriftTolerance: env.QUIZ_TIMER_DRIFT_TOLERANCE,
        markAbsentDelay: env.QUIZ_MARK_ABSENT_DELAY,
        manualStartVisibilityWindow: env.QUIZ_MANUAL_START_VISIBILITY_WINDOW, // seconds
        reconciliationIntervalMs: env.QUIZ_RECONCILIATION_INTERVAL_MS,
        reconciliationLookaheadMs: env.QUIZ_RECONCILIATION_LOOKAHEAD_MS,
        reconciliationGraceMs: env.QUIZ_RECONCILIATION_GRACE_MS,
        submissionLockTtlMs: env.QUIZ_SUBMISSION_LOCK_TTL_MS,
    },

    contest: {
        // Start times must land on this grid (minutes) — see contest.validator.ts.
        startTimeSlotMinutes: env.CONTEST_START_TIME_SLOT_MINUTES,
    },

    // Convenience alias — quiz module uses config.ws / config.app.frontendUrl
    ws: {
        namespace: env.WS_NAMESPACE,
        path: env.WS_PATH,
        heartbeatInterval: env.WS_HEARTBEAT_INTERVAL,
        maxConnections: env.WS_MAX_CONNECTIONS_PER_INSTANCE,
        connectionTimeout: env.WS_CONNECTION_TIMEOUT,
        reconnectAttempts: env.WS_RECONNECT_ATTEMPTS,
        reconnectDelay: env.WS_RECONNECT_DELAY,
    },

    features: {
        proctoring: env.ENABLE_PROCTORING,
        analytics: env.ENABLE_ANALYTICS,
        certificates: env.ENABLE_CERTIFICATES,
        notifications: env.ENABLE_NOTIFICATIONS,
    },
    questions: {
        bulkImportLimit: env.BULK_IMPORT_LIMIT,
    },
    idempotency: {
        enabled: env.IDEMPOTENCY_ENABLED,
    },
    puppeteer: {
        executablePath: env.PUPPETEER_EXECUTABLE_PATH,
    },

    sentry: {
        dsn: env.SENTRY_DSN,
        appVersion: env.APP_VERSION,
        tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
        profilesSampleRate: env.SENTRY_PROFILES_SAMPLE_RATE,
    },

    posthog: {
        apiKey: env.POSTHOG_API_KEY,
        host: env.POSTHOG_HOST,
        flushAt: env.POSTHOG_FLUSH_AT,
        flushInterval: env.POSTHOG_FLUSH_INTERVAL,
    },
} as const;

/**
 * ----------------------------------------
 * TYPE EXPORT
 * ----------------------------------------
 */

export type AppConfig = typeof config;