import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";

// Import workers ONLY to trigger registration
import "./message.worker";
import "./submission.worker";
import "./certificate.worker";
import "./evaluation.worker";
// quiz-timer.worker is imported via container.ts (worker.ts) for DI injection + registration
import "./analytics.worker";
import "./leaderboard.worker";
import "./capture-metadata.worker";
import "./export.worker";

export function startWorkers() {
    logger.info("Starting background workers...");
    workerRegistry.startAll();
    logger.info("All worker started successfully");
}