import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

/**
 * ----------------------------------------
 * ENV VALIDATION SCHEMA
 * ----------------------------------------
 */

const envSchema = z.object({
  // APP
  NODE_ENV: z.enum(["development", "staging", "production"]),
  APP_NAME: z.string(),
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  INSTANCE_ID: z.string(),
  INSTANCE_COUNT: z.coerce.number().default(1),

  // DATABASE
  DATABASE_URL: z.string().url(),
  DB_POOL_MIN: z.coerce.number().default(5),
  DB_POOL_MAX: z.coerce.number().default(20),
  DB_QUERY_TIMEOUT: z.coerce.number().default(5000),

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
  MAX_SLUG_RETRIES: z.coerce.number().default(5),
  JOIN_CODE_LENGTH: z.coerce.number().default(6),
  BULK_IMPORT_LIMIT: z.coerce.number().default(500),

  // PUPPETEER
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
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
  },

  database: {
    url: env.DATABASE_URL,
    pool: {
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
    },
    timeout: env.DB_QUERY_TIMEOUT,
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

    payment:{
        razorpay: {
            keyId: env.RAZORPAY_KEY_ID,
            keySecret: env.RAZORPAY_KEY_SECRET,
            webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
        },
        currency: env.PAYMENT_CURRENCY,
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

    pubsub: {
        enabled: env.REDIS_PUBSUB_ENABLED,
        prefix: env.REDIS_PUBSUB_PREFIX,
    },

    limits:{
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
} as const;

/**
 * ----------------------------------------
 * TYPE EXPORT
 * ----------------------------------------
 */

export type AppConfig = typeof config;