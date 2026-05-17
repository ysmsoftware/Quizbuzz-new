import dotenv from "dotenv";

import logger from "./config/logger";
import { startWorkers } from "./workers";
import { config } from "./config";

if (!config.app.nodeEnv) {
    config.app.nodeEnv == 'development';
}


logger.info("Worker process started");

startWorkers();


process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception in worker:", err);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection in worker at:", promise, "reason:", reason);
});