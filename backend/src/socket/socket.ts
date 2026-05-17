import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server as HTTPServer } from "http";
import { pubClient, subClient } from "../config/redis.js";
import { config } from "../config/index.js";
import logger from "../config/logger.js";
import { socketAuthMiddleware } from "./socket.middleware.js";

export class SocketService {
    private io!: SocketIOServer;

    attach(httpServer: HTTPServer): SocketIOServer {
        this.io = new SocketIOServer(httpServer, {
            path: config.ws?.path || "/socket.io",
            cors: {
                origin: config.cors.allowedOrigins,
                methods: ["GET", "POST"],
                credentials: true,
            },
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
            },
            maxHttpBufferSize: 2e6, // 2 MB
        });

        // Redis adapter for horizontal scaling
        if (config.pubsub?.enabled) {
            this.io.adapter(createAdapter(pubClient, subClient));
            logger.info("[socket] Redis adapter attached for horizontal scaling");
        }

        logger.info(`[socket] Socket.IO server attached to HTTP server`);

        return this.io;
    }

    getIO(): SocketIOServer {
        if (!this.io) {
            throw new Error("Socket.IO not initialized. Call attach(httpServer) first.");
        }
        return this.io;
    }

    /**
     * Apply authentication middleware to a namespace
     */
    applyAuth(namespace: string = "/"): void {
        this.io.of(namespace).use(socketAuthMiddleware);
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        if (this.io) {
            return new Promise((resolve) => {
                this.io.close(() => {
                    logger.warn("[socket] Socket.IO server closed");
                    resolve();
                });
            });
        }
    }
}
