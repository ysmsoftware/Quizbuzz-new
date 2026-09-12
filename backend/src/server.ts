// Pin every instance's baseline timezone to UTC, before anything else runs — Date
// formatting that doesn't pass an explicit IANA timezone (see utils/timezone.ts for
// the ones that must) would otherwise silently follow whatever the OS defaults to,
// which differs between a developer's machine and a fresh AWS instance, and can even
// differ instance-to-instance under auto-scaling. Pinning this gives every instance
// the same deterministic starting point regardless of where/when it was spun up.
process.env.TZ = "UTC";

import "./instrument";
import * as Sentry from "@sentry/node";
import logger from "./config/logger";
import dotenv from "dotenv";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { analyticsTracker } from "./services/analytics.service";
dotenv.config();

import app from "./app";
import { connectDB, prisma } from "./config/db";
import { redis } from "./config/redis";
import { createServer, Server } from "http";

import './config';
import { config } from './config';
import { quizGateway, adminGateway } from "./container.js";
import { opsMetricsService } from "./container.js";

let server: Server;
let isShuttingDown = false;
let opsMetricsHeartbeatTimer: ReturnType<typeof setInterval> | undefined;
let eventLoopLagTimer: ReturnType<typeof setInterval> | undefined;

async function bootstrap() {
    try {
        logger.info("Bootstrapping server...");

        await connectDB();

        // Create HTTP server explicitly so Socket.IO can attach to it
        server = createServer(app);

        // Attach WebSocket Service (handles Redis adapter and middleware)
        const { socketService } = await import("./container.js");
        const io = socketService.attach(server);

        // Apply auth middleware to namespaces before attaching gateways
        socketService.applyAuth("participant");
        socketService.applyAuth("/quiz-admin");

        // Attach listeners for specific gateways
        quizGateway.attach(io);
        adminGateway.attach(io);

        server.listen(config.app.port, () => {
            logger.info(`Server is running on port ${config.app.port}`);
        });

        // Ops metrics heartbeat — fire once immediately so the fleet view
        // isn't empty for the first interval tick, then on a timer. See
        // ops-metrics.service.ts / the WebSocket memory audit's addendum
        // for why this needs to be a Redis fan-in rather than a direct
        // per-instance scrape (ASG quiz instances have no public IP).
        void opsMetricsService.reportHeartbeat("backend");
        opsMetricsHeartbeatTimer = setInterval(
            () => void opsMetricsService.reportHeartbeat("backend"),
            config.opsMetrics.heartbeatIntervalMs,
        );
        opsMetricsHeartbeatTimer.unref();

        // Event-loop lag monitor — every application-level hot path (join, answer,
        // disconnect, heartbeat, admin broadcasts) has been individually audited and
        // is either O(1) or already throttled, yet the mass ping-timeout cascade
        // persists at load. This is the one thing never directly measured: whether
        // the backend Node process itself is stalling at the moment of failure. If
        // p99/max spikes line up with the disconnect wave, that's decisive evidence
        // of CPU-bound/GC/blocking work; if it stays flat through the cascade, the
        // bottleneck is external (network path, ALB, Redis, or the test client).
        // See load-testing/LOAD_TEST_INCIDENT_REPORT.md.
        const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
        eventLoopHistogram.enable();
        eventLoopLagTimer = setInterval(() => {
            logger.info(
                `[event-loop-lag] min=${(eventLoopHistogram.min / 1e6).toFixed(1)}ms ` +
                `mean=${(eventLoopHistogram.mean / 1e6).toFixed(1)}ms ` +
                `p95=${(eventLoopHistogram.percentile(95) / 1e6).toFixed(1)}ms ` +
                `p99=${(eventLoopHistogram.percentile(99) / 1e6).toFixed(1)}ms ` +
                `max=${(eventLoopHistogram.max / 1e6).toFixed(1)}ms`
            );
            eventLoopHistogram.reset();
        }, 5000);
        eventLoopLagTimer.unref();

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);

    } catch (error) {
        Sentry.captureException(error);
        logger.error("Failed to start server", error);
        process.exit(1);
    }
}

async function shutdown() {
    // Guard: ignore duplicate signals
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.warn("Shutdown signal received, draining connections...");

    // Force-exit after 15s if graceful drain takes too long.
    const forceExit = setTimeout(() => {
        logger.error("Graceful shutdown timed out after 15s, forcing exit");
        process.exit(1);
    }, 15_000);
    forceExit.unref();

    if (opsMetricsHeartbeatTimer) clearInterval(opsMetricsHeartbeatTimer);
    if (eventLoopLagTimer) clearInterval(eventLoopLagTimer);

    // 1. Shut down Socket.IO (stops accepting new WS connections)
    try {
        const { socketService } = await import("./container.js");
        await socketService.shutdown();
        logger.warn("Socket.IO server closed");
    } catch (err: any) {
        Sentry.captureException(err);
        logger.error("Socket.IO shutdown error", err);
    }

    // 2. Stop accepting new HTTP requests, wait for in-flight ones to finish
    if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        logger.warn("HTTP server closed");
    }

    // 3. Close DB and Redis connections cleanly
    await Promise.allSettled([
        prisma.$disconnect().then(() => logger.warn("Prisma disconnected")),
        redis.quit().then(() => logger.warn("Redis disconnected")),
    ]);

    await Promise.allSettled([
        Sentry.close(2000),
        analyticsTracker.shutdown(),
    ]);

    logger.warn("Shutdown complete");
    process.exit(0);
}

bootstrap();
