import { Server as SocketIOServer, Socket } from "socket.io";
import logger from "../../config/logger";
import { QuizService } from "./quiz.service";
import { ProctoringService } from "./proctoring.service";
import { AdminSubscribeSchema, AdminBroadcastSchema } from "./quiz.validator";
import { AdminSubscribePayload, AdminBroadcastPayload } from "./quiz.types";

/**
 * Narrow port onto QuizGateway — same late-binding approach as
 * IContestBroadcaster in contest.service.ts, so AdminGateway doesn't need a
 * hard constructor dependency on QuizGateway (which is wired up alongside it
 * in container.ts, not before it).
 */
export interface IParticipantBroadcaster {
    emitBroadcastMessage(contestId: string, payload: { type: string; text: string }): void;
}

export class AdminGateway {
    private io!: SocketIOServer;
    private readonly NAMESPACE = "/quiz-admin";
    private participantBroadcaster?: IParticipantBroadcaster;

    constructor(
        private quizService: QuizService,
        private proctoringService: ProctoringService
    ) {}

    setParticipantBroadcaster(broadcaster: IParticipantBroadcaster): void {
        this.participantBroadcaster = broadcaster;
    }

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
            socket.on("admin:v1:broadcast", (data) => this.handleBroadcast(socket, data));

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

    /**
     * Relay an admin's message to every participant in the live quiz room.
     * This event was previously emitted by the frontend with no server-side
     * listener at all, so it was silently dropped — nothing broke, nothing
     * errored, the admin just never saw an effect. Wired through
     * participantBroadcaster (bound to QuizGateway in container.ts) rather
     * than a direct import to avoid a circular gateway dependency.
     */
    private async handleBroadcast(socket: Socket, data: unknown): Promise<void> {
        try {
            const parsed = AdminBroadcastSchema.parse(data) as AdminBroadcastPayload;

            if (!this.participantBroadcaster) {
                logger.error("[AdminGateway] Broadcast requested but no participantBroadcaster is wired");
                this.emitError(socket, new Error("Broadcast is temporarily unavailable"));
                return;
            }

            this.participantBroadcaster.emitBroadcastMessage(parsed.contestId, {
                type: parsed.type,
                text: parsed.message,
            });

            logger.info(`[AdminGateway] Admin ${socket.data.userId} broadcast to contest ${parsed.contestId}`);
        } catch (error: any) {
            this.emitError(socket, error);
        }
    }

    private async emitLiveStats(socket: Socket, contestId: string): Promise<void> {
        const organizationId = socket.data.organizationId as string;
        const snapshot = await this.quizService.getAdminLiveSnapshot(
            contestId,
            organizationId,
        );
        socket.emit("admin:v1:live-stats", snapshot);
    }

    /** Push live stats to every admin subscribed to this contest room */
    async broadcastLiveStats(contestId: string, organizationId: string): Promise<void> {
        const snapshot = await this.quizService.getAdminLiveSnapshot(
            contestId,
            organizationId,
        );
        this.io.of(this.NAMESPACE).to(`admin:${contestId}`).emit("admin:v1:live-stats", snapshot);
    }

    private emitError(socket: Socket, error: any): void {
        const message = error.message || "An unexpected error occurred";
        socket.emit("admin:v1:error", { message });
    }
}
