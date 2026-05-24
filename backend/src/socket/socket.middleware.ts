import { Socket, Namespace } from "socket.io";
import { verifyToken } from "../utils/jwt";
import logger from "../config/logger";

interface ExtendedError extends Error {
    data?: any;
}

/**
 * Socket.IO Middleware for JWT Authentication
 * 
 * Supports both participant session tokens and admin access tokens.
 * Extracts organizationId, participantId/userId and contestId from token payload.
 */
export const socketAuthMiddleware = (socket: Socket, next: (err?: ExtendedError) => void) => {
    try {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.auth?.sessionToken ||
            socket.handshake.headers?.authorization?.replace("Bearer ", "");

        if (!token) {
            logger.warn(`[socket-auth] Connection rejected: No token provided (socket: ${socket.id})`);
            return next(new Error("Authentication failed: No token provided"));
        }

        const payload = verifyToken(token) as any;

        if (!payload) {
            logger.warn(`[socket-auth] Connection rejected: Invalid token (socket: ${socket.id})`);
            return next(new Error("Authentication failed: Invalid token"));
        }

        // Attach user info to socket
        socket.data.userId = payload.userId || payload.participantId;
        socket.data.participantId = payload.participantId;
        socket.data.organizationId = payload.organizationId;
        socket.data.contestId = payload.contestId;
        socket.data.role = payload.role || (payload.participantId ? "participant" : "admin");

        logger.debug(`[socket-auth] Authenticated ${socket.data.role}: ${socket.data.userId} (socket: ${socket.id})`);

        next();
    } catch (error: any) {
        logger.error(`[socket-auth] Auth error: ${error.message}`);
        next(new Error("Authentication failed"));
    }
};
