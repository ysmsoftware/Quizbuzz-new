import "./instrument"; // ← first
import * as Sentry from "@sentry/node";
import dotenv from "dotenv";
dotenv.config();

import logger from "./config/logger";

// Initialize DI and inject quiz-timer worker deps (gateway, quizService, prisma, etc.)
import "./container";

import { startWorkers } from "./workers";

logger.info("Worker process started");

startWorkers();

process.on("uncaughtException", (err) => {
    Sentry.captureException(err, { tags: { process: "worker" } });
    logger.error("Uncaught Exception in worker:", err);
});

process.on("unhandledRejection", (reason, promise) => {
    Sentry.captureException(reason, { tags: { process: "worker" } });
    logger.error("Unhandled Rejection in worker at:", promise, "reason:", reason);
});