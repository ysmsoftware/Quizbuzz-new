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
export const subClient = redis.duplicate();

redis.on("connect", () => {
    logger.info("Redis connected");
});

redis.on("error", (err) => {
    logger.info(`Redis error ${err}`);
});
