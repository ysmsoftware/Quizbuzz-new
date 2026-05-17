import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";

// Import workers ONLY to trigger registration
import "./message.worker";
import "./submission.worker";
import "./certificate.worker";
import "./evaluation.worker";
import "./quiz-timer.worker";
import "./analytics.worker";
import "./leaderboard.worker";

export function startWorkers() {
    logger.info("Starting background workers...");
    workerRegistry.startAll();
    logger.info("All worker started successfully");
}