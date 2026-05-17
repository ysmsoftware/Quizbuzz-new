import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis";
import { config } from "../config";
import logger from "../config/logger";

/**
 * Idempotency Middleware
 *
 * Redis-backed idempotency handler that intercepts POST/PUT/PATCH requests
 * carrying an Idempotency-Key header. On first request, stores the response.
 * On replay with same key, returns cached response without re-executing handler.
 *
 * Usage: mount on routes that must not repeat
 *   paymentRouter.post("/create-order", idempotency, paymentController.createOrder);
 *   submissionRouter.post("/:contestId/submit", idempotency, submissionController.submit);
 *
 * Requires: IDEMPOTENCY_ENABLED and IDEMPOTENCY_TTL env vars in config.
 */

const TTL = config.redis.ttl.idempotency; // seconds

export const idempotency = async (req: Request, res: Response, next: NextFunction) => {
    // Feature flag: if disabled, pass through normally
    if (!config.idempotency.enabled) {
        return next();
    }

    // Header check: if absent, pass through normally
    const key = req.headers["idempotency-key"] as string | undefined;
    if (!key) {
        return next();
    }

    // Guard: only cache POST, PUT, PATCH — never GET or DELETE
    const isMutating = ["POST", "PUT", "PATCH"].includes(req.method);
    if (!isMutating) {
        return next();
    }

    // Build Redis key: organization-scoped to avoid cross-tenant collisions
    const organizationId = (req as any).user?.organizationId ?? "anon";
    const redisKey = `idempotency:${organizationId}:${key}`;

    try {
        // ── Step 1: Check for a cached response ──────────────────────────

        const cached = await redis.get(redisKey);
        if (cached) {
            logger.info(
                `[idempotency] Cache hit — method=${req.method} path=${req.path} key=${key}`
            );
            const { status, body } = JSON.parse(cached);
            return res.status(status).json(body);
        }

        // ── Step 2: Intercept the response before it leaves ───────────────

        const originalJson = res.json.bind(res);
        res.json = (body: any) => {
            // Only cache 2xx responses (success)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                redis
                    .set(
                        redisKey,
                        JSON.stringify({ status: res.statusCode, body }),
                        "EX",
                        TTL
                    )
                    .catch(() => {
                        // Fire-and-forget; never block the response
                        logger.warn(
                            `[idempotency] Failed to cache response — key=${key}`
                        );
                    });
                logger.info(
                    `[idempotency] Cached successful response — method=${req.method} path=${req.path} key=${key}`
                );
            }
            return originalJson(body);
        };

        next();
    } catch (error) {
        // On any Redis error, fail open (bypass idempotency) and let request proceed
        logger.error(
            `[idempotency] Redis error — key=${key} error=${error instanceof Error ? error.message : String(error)}`
        );
        next();
    }
};
