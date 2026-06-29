import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server as HTTPServer } from "http";
import { pubClient, subClient } from "../config/redis.js";
import { config } from "../config/index.js";
import logger from "../config/logger.js";
import { socketAuthMiddleware } from "./socket.middleware.js";
import { incrementWsConnections, decrementWsConnections } from "../ws-connections.js";

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
            // Quiz sessions last up to 2 hours. Use generous ping settings so
            // the server doesn't close idle-looking connections mid-quiz.
            // Default pingInterval=25s + pingTimeout=20s = drops at 45s under load.
            // At 5000 concurrent connections the event loop can lag >20s on a ping
            // response, causing false disconnections. Set timeout to 60s to give
            // the event loop headroom without waiting too long for truly dead clients.
            pingInterval: 25000,   // send PING every 25s (unchanged)
            pingTimeout:  60000,   // wait 60s for PONG before declaring dead (was 20s)
            upgradeTimeout: 30000, // time to complete WebSocket upgrade (was 10s)
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

        // Track active WebSocket connections so /health can implement drain mode.
        // Listen per-namespace (not on root io) to avoid double-counting, since
        // Socket.IO fires the root 'connection' event AND the namespace event for
        // the same socket when using named namespaces.
        this.io.of("participant").on("connection", (socket: any) => {
            incrementWsConnections();
            socket.on("disconnect", () => decrementWsConnections());
        });
        this.io.of("/quiz-admin").on("connection", (socket: any) => {
            incrementWsConnections();
            socket.on("disconnect", () => decrementWsConnections());
        });

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
