// Pin every instance's baseline timezone to UTC, before anything else runs — see the
// matching comment in server.ts. Workers are exactly the process this matters most
// for: they're what actually formats dates into emails/certificates/exports, and are
// the ones auto-scaling spins up/down across potentially different AWS AZs.
process.env.TZ = "UTC";

import "./instrument"; // ← first
import * as Sentry from "@sentry/node";
import dotenv from "dotenv";
dotenv.config();

import logger from "./config/logger";

// Initialize DI and inject quiz-timer worker deps (gateway, quizService, prisma, etc.)
import { opsMetricsService } from "./container";
import { config } from "./config";

import { startWorkers } from "./workers";

logger.info("Worker process started");

startWorkers();

// Ops metrics heartbeat for this process, reported under its own
// "worker" role key so a heap-vs-container-limit mismatch on the worker
// specifically (see the WebSocket memory audit's addendum — the worker's
// NODE_OPTIONS heap ceiling can exceed its own Docker memory limit in live
// mode, independent of the backend container) is visible on its own,
// not folded into the backend instance's numbers.
void opsMetricsService.reportHeartbeat("worker");
setInterval(
    () => void opsMetricsService.reportHeartbeat("worker"),
    config.opsMetrics.heartbeatIntervalMs,
).unref();

process.on("uncaughtException", (err) => {
    Sentry.captureException(err, { tags: { process: "worker" } });
    logger.error("Uncaught Exception in worker:", err);
});

process.on("unhandledRejection", (reason, promise) => {
    Sentry.captureException(reason, { tags: { process: "worker" } });
    logger.error("Unhandled Rejection in worker at:", promise, "reason:", reason);
});