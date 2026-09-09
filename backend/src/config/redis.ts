import Redis from 'ioredis';
import logger from './logger';
import { config } from "../config/index";

export const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    ...(config.redis.password && { password: config.redis.password }),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 50, 2000),
});

// For Socket.IO Redis Adapter
export const pubClient = redis.duplicate();
export const subClient = redis.duplicate({ enableReadyCheck: false });

// Separate connection for admin/ops dashboard reads (live-monitor snapshot, ops-metrics
// fan-in). config.redis.readerHost points at the ElastiCache reader/replica endpoint in
// live mode (falls back to the same host as `redis` in idle mode / local dev, where
// there's only one Redis container). Two things this buys, together:
//   1. A separate TCP connection means a large admin-snapshot pipeline (thousands of
//      commands in one go) can't head-of-line-block a participant's own gameplay
//      command that happens to be queued on the SAME connection right after it —
//      replies on one connection come back strictly in send order.
//   2. Pointing it at the replica node (not just a 2nd connection to the primary) moves
//      that read CPU work off the single-threaded primary entirely, so it isn't
//      competing with participant writes for the same core.
// Never write through this client — the replica is read-only and can lag the primary
// by a small amount under async replication, which is fine for a dashboard a human is
// glancing at but not for anything that needs to read its own just-written state.
export const redisReader = new Redis({
    host: config.redis.readerHost,
    port: config.redis.port,
    ...(config.redis.password && { password: config.redis.password }),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on("connect", () => {
    logger.info("Redis connected");
});

redis.on("error", (err) => {
    logger.info(`Redis error ${err}`);
});

redisReader.on("connect", () => {
    logger.info(`Redis reader connected (${config.redis.readerHost})`);
});

redisReader.on("error", (err) => {
    logger.info(`Redis reader error ${err}`);
});
