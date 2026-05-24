import logger from "./config/logger";
import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB, prisma } from "./config/db";
import { redis } from "./config/redis";
import { createServer, Server } from "http";

import './config';
import { config } from './config';
import { quizGateway, adminGateway } from "./container.js";

let server: Server;
let isShuttingDown = false;

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

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);

    } catch (error) {
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

    // 1. Shut down Socket.IO (stops accepting new WS connections)
    try {
        const { socketService } = await import("./container.js");
        await socketService.shutdown();
        logger.warn("Socket.IO server closed");
    } catch (err: any) {
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

    logger.warn("Shutdown complete");
    process.exit(0);
}

bootstrap();
