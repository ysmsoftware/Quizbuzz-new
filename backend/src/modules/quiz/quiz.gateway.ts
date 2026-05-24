import { Server, Socket } from "socket.io";
import { QuizService } from "./quiz.service.js";
import { ProctoringService } from "./proctoring.service.js";
import logger from "../../config/logger.js";
import { redis } from "../../config/redis.js";
import { 
    ViolationPayload, 
    AnswerPayload, 
    SubmitPayload,
    JoinPayload 
} from "./quiz.types.js";
import { prisma } from "../../config/db.js";

export class QuizGateway {
    server!: Server;
    private subscriberClient?: any;

    constructor(
        private quizService: QuizService,
        private proctoringService: ProctoringService
    ) {}

    attach(io: Server) {
        this.server = io;
        const participantNs = io.of("participant");
        
        participantNs.on("connection", (socket: Socket) => {
            this.handleConnection(socket);
            
            socket.on("quiz:v1:join", (payload) => this.handleJoin(socket, payload));
            socket.on("quiz:v1:heartbeat", () => this.handleHeartbeat(socket));
            socket.on("quiz:v1:answer", (payload) => this.handleAnswer(socket, payload));
            socket.on("quiz:v1:violation", (payload) => this.handleViolation(socket, payload));
            socket.on("quiz:v1:submit", (payload) => this.handleSubmit(socket, payload));
            
            socket.on("disconnect", () => this.handleDisconnect(socket));
        });

        // Initialize Redis pub/sub listener for cross-process WebSocket events
        this.setupRedisSubscriber();
    }

    private setupRedisSubscriber() {
        try {
            this.subscriberClient = redis.duplicate({ enableReadyCheck: false });
            
            this.subscriberClient.on("connect", () => {
                logger.info("[QuizGateway] Cross-process Redis subscriber connected");
                this.subscriberClient.subscribe("quizbuzz:socket-emit").catch((err: any) => {
                    logger.error("[QuizGateway] Redis subscription failed:", err);
                });
            });

            this.subscriberClient.on("message", (channel: string, message: string) => {
                if (channel === "quizbuzz:socket-emit") {
                    try {
                        const { namespace, room, event, data } = JSON.parse(message);
                        logger.debug(`[QuizGateway] Received socket-emit from Redis: ${namespace} -> ${room} -> ${event}`);
                        
                        let ns: any = this.server;
                        if (namespace && namespace !== "/") {
                            ns = this.server.of(namespace);
                        }
                        
                        ns.to(room).emit(event, data);
                    } catch (err) {
                        logger.error("[QuizGateway] Cross-process socket-emit parsing/emitting failed:", err);
                    }
                }
            });

            this.subscriberClient.on("error", (err: any) => {
                logger.error("[QuizGateway] Cross-process Redis subscriber error:", err);
            });
        } catch (err) {
            logger.error("[QuizGateway] Failed to setup Redis subscriber:", err);
        }
    }

    private async emitAdminLiveStats(contestId: string, organizationId: string): Promise<void> {
        const snapshot = await this.quizService.getAdminLiveSnapshot(contestId, organizationId);
        this.broadcastAdminEvent(contestId, "admin:v1:live-stats", snapshot);
    }

    private async getParticipantName(participantId: string): Promise<string> {
        const row = await prisma.participant.findUnique({
            where: { id: participantId },
            select: {
                contact: { select: { firstName: true, lastName: true } },
            },
        });
        if (!row?.contact) return "Participant";
        return [row.contact.firstName, row.contact.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || "Participant";
    }

    private emitSocket(namespace: string, room: string, event: string, data: any) {
        if (this.server) {
            let ns: any = this.server;
            if (namespace && namespace !== "/") {
                ns = this.server.of(namespace);
            }
            ns.to(room).emit(event, data);
        } else {
            logger.info(`[QuizGateway] Worker publishing socket-emit to Redis: ${namespace} -> ${room} -> ${event}`);
            redis.publish("quizbuzz:socket-emit", JSON.stringify({ namespace, room, event, data }))
                .catch(err => logger.error("[QuizGateway] Redis publish failed:", err));
        }
    }

    async handleConnection(socket: Socket) {
        const { participantId, contestId } = socket.data;
        logger.info(`[QuizGateway] Participant ${participantId} connected to socket ${socket.id}`);
        await socket.join(`contest:${contestId}`);
        await socket.join(`participant:${participantId}`);
    }

    async handleDisconnect(socket: Socket) {
        const { participantId, contestId, organizationId } = socket.data;
        logger.info(`[QuizGateway] Participant ${participantId} disconnected`);

        if (participantId && contestId) {
            await this.quizService.handleDisconnect(contestId, participantId);
            // Push updated counts to admin
            await this.emitAdminLiveStats(contestId, organizationId).catch(() => {});
        }
    }

    async handleJoin(socket: Socket, payload: JoinPayload) {
        const { participantId, contestId, organizationId } = socket.data;

        // Re-join rooms — idempotent, safe on reconnect
        await socket.join(`contest:${contestId}`);
        await socket.join(`participant:${participantId}`);

        // Resolve name once from DB; stored in Redis meta so subsequent calls are free
        const participantName = await this.getParticipantName(participantId);

        const result = await this.quizService.joinWaitingRoom(
            contestId,
            participantId,
            participantName,
            socket.data.contactId,
        );

        if (result.status === "IN_QUIZ" || result.status === "SUBMITTED") {
            if (result.status === "SUBMITTED") {
                // Already submitted — redirect
                socket.emit("quiz:v1:waiting_room_status", { status: "SUBMITTED" });
                return;
            }
            // Participant already has a running session — send quiz data directly
            const rejoinData = await this.quizService.handleRejoin(contestId, participantId);
            if (rejoinData) {
                socket.emit("quiz:v1:start", rejoinData);
            }
            await this.emitAdminLiveStats(contestId, organizationId).catch(() => {});
            return;
        }

        // Normal waiting-room status
        socket.emit("quiz:v1:waiting_room_status", result);

        this.server.of("/quiz-admin").to(`admin:${contestId}`).emit("admin:v1:participant_joined", {
            participantId,
            name: participantName,
            status: result.status,
            participantCount: result.participantCount,
            timestamp: new Date().toISOString(),
        });

        await this.emitAdminLiveStats(contestId, organizationId);
    }

    async handleHeartbeat(socket: Socket) {
        const { participantId, contestId } = socket.data;
        await this.quizService.handleHeartbeat(contestId, participantId);
    }

    async handleAnswer(socket: Socket, payload: AnswerPayload) {
        const { participantId, contestId } = socket.data;

        // ── Debug log: incoming answer event ────────────────────────────────
        logger.info(
            `[QuizGateway:answer] contestId=${contestId} | participantId=${participantId} | ` +
            `questionId=${payload.questionId} | selectedOptionId=${payload.selectedOptionId ?? "(skipped)"} | ` +
            `answeredAt=${payload.answeredAt}`
        );

        const success = await this.quizService.saveAnswer(
            contestId,
            participantId,
            payload.questionId,
            payload.selectedOptionId,
            payload.answeredAt
        );

        if (success) {
            const progress = await this.quizService.getParticipantProgress(contestId, participantId);

            // ── Debug log: answer saved successfully ─────────────────────────
            logger.info(
                `[QuizGateway:answer] SAVED ✓ | contestId=${contestId} | participantId=${participantId} | ` +
                `questionId=${payload.questionId} | answeredCount=${progress.answeredCount}/${progress.totalQuestions}`
            );

            socket.emit("quiz:v1:answer_saved", { questionId: payload.questionId });
            this.server.of("/quiz-admin").to(`admin:${contestId}`).emit("admin:v1:participant_progress", {
                participantId,
                ...progress,
            });
        } else {
            // ── Debug log: answer rejected (phase guard or missing session) ──
            logger.warn(
                `[QuizGateway:answer] REJECTED ✗ | contestId=${contestId} | participantId=${participantId} | ` +
                `questionId=${payload.questionId} | reason=phase_not_IN_QUIZ_or_session_missing`
            );
            socket.emit("quiz:v1:answer_saved", { questionId: payload.questionId, rejected: true });
        }
    }

    async handleViolation(socket: Socket, payload: ViolationPayload) {
        const { participantId, contestId, organizationId } = socket.data;
        const result = await this.proctoringService.recordViolation(
            participantId,
            contestId,
            organizationId,
            { ...payload, timestamp: new Date().toISOString() }
        );

        socket.emit("quiz:v1:violation_update", { count: result.totalViolations });

        const name = await this.getParticipantName(participantId);
        this.server.of("/quiz-admin").to(`admin:${contestId}`).emit("admin:v1:violation_alert", {
            participantId,
            name,
            type: payload.type,
            severity: payload.severity,
            violationCount: result.totalViolations,
            trustScore: Math.max(0, 100 - result.totalViolations * 10),
            isFlagged: result.flagged,
            occurredAt: new Date().toISOString(),
        });

        await this.emitAdminLiveStats(contestId, organizationId);
    }

    async handleSubmit(socket: Socket, payload: SubmitPayload) {
        const { participantId, contestId, organizationId } = socket.data;
        const result = await this.quizService.submitQuiz(contestId, participantId, "MANUAL");
        socket.emit("quiz:v1:submit_success", result);

        const name = await this.getParticipantName(participantId);
        this.server.of("/quiz-admin").to(`admin:${contestId}`).emit("admin:v1:participant_submitted", {
            participantId,
            name,
            submissionRef: result.submissionRef,
            timestamp: new Date().toISOString(),
        });

        await this.emitAdminLiveStats(contestId, organizationId);
    }

    // ─── Worker Integration Methods ───────────────────────────────────────────

    async startQuizForParticipant(pid: string, cid: string, oid: string, contactId: string) {
        try {
            // Name is already in Redis meta from joinWaitingRoom — pass undefined
            // to skip the DB call in startQuiz (meta already set)
            const result = await this.quizService.startQuiz(cid, oid, pid, contactId, "worker-trigger");
            this.emitSocket("participant", `participant:${pid}`, "quiz:v1:start", result);
        } catch (err) {
            logger.error(`[QuizGateway] Failed to start quiz for ${pid}: ${err}`);
        }
    }

    emitTimeWarning(cid: string, seconds: number) {
        this.emitSocket("participant", `contest:${cid}`, "quiz:v1:time_warning", { secondsRemaining: seconds });
    }

    async emitAutoSubmit(pid: string, cid: string, reason: string) {
        try {
            const result = await this.quizService.submitQuiz(cid, pid, "AUTO");
            this.emitSocket("participant", `participant:${pid}`, "quiz:v1:auto_submit", {
                reason,
                submissionRef: result.submissionRef
            });
        } catch (err) {
            logger.error(`[QuizGateway] Failed to auto-submit for ${pid}: ${err}`);
        }
    }

    async emitCaptureRequest(pid: string, captureType: string, captureId?: string) {
        this.emitSocket("participant", `participant:${pid}`, "quiz:v1:capture_request", {
            captureType,
            captureId: captureId ?? `cap_${pid}_${Date.now()}`,
        });
    }

    broadcastAdminEvent(cid: string, event: string, data: unknown) {
        this.emitSocket("/quiz-admin", `admin:${cid}`, event, data);
    }
}
