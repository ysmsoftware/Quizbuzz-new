import { Server as SocketIOServer, Socket } from "socket.io";
import logger from "../../config/logger";
import { QuizService } from "./quiz.service";
import { ProctoringService } from "./proctoring.service";
import { AdminSubscribeSchema } from "./quiz.validator";
import { AdminSubscribePayload } from "./quiz.types";

export class AdminGateway {
    private io!: SocketIOServer;
    private readonly NAMESPACE = "/quiz-admin";

    constructor(
        private quizService: QuizService,
        private proctoringService: ProctoringService
    ) {}

    /**
     * Attach gateway listeners to the provided Socket.IO server
     */
    attach(io: SocketIOServer): void {
        this.io = io;
        const ns = this.io.of(this.NAMESPACE);

        ns.on("connection", (socket: Socket) => {
            const { userId, organizationId } = socket.data;
            logger.info(`[AdminGateway] Admin ${userId} connected to socket ${socket.id}`);

            socket.on("admin:v1:subscribe", (data) => this.handleSubscribe(socket, data));
            socket.on("admin:v1:request-stats", (data) => this.handleRequestStats(socket, data));

            socket.on("disconnect", () => {
                logger.info(`[AdminGateway] Admin ${userId} disconnected`);
            });
        });

        logger.info(`[AdminGateway] Attached to namespace ${this.NAMESPACE}`);
    }

    private async handleSubscribe(socket: Socket, data: unknown): Promise<void> {
        try {
            const parsed = AdminSubscribeSchema.parse(data) as AdminSubscribePayload;
            
            // Join contest-specific admin room
            socket.join(`admin:${parsed.contestId}`);
            
            logger.info(`[AdminGateway] Admin ${socket.data.userId} subscribed to contest ${parsed.contestId}`);

            // Fetch and emit initial stats
            await this.emitLiveStats(socket, parsed.contestId);
        } catch (error: any) {
            this.emitError(socket, error);
        }
    }

    private async handleRequestStats(socket: Socket, data: unknown): Promise<void> {
        try {
            const parsed = AdminSubscribeSchema.parse(data) as AdminSubscribePayload;
            await this.emitLiveStats(socket, parsed.contestId);
        } catch (error: any) {
            this.emitError(socket, error);
        }
    }

    private async emitLiveStats(socket: Socket, contestId: string): Promise<void> {
        // This would involve fetching counts from Redis/DB
        // For now, emit a placeholder or use specialized service methods if available
        // In the full implementation, QuizService or a specialized AnalyticsService would provide this
        socket.emit("admin:v1:live-stats", {
            contestId,
            timestamp: new Date().toISOString(),
            // activeParticipants: ...,
            // totalSubmissions: ...,
            // totalViolations: ...
        });
    }

    private emitError(socket: Socket, error: any): void {
        const message = error.message || "An unexpected error occurred";
        socket.emit("admin:v1:error", { message });
    }
}
