import { Server, Socket } from "socket.io";
import { QuizService } from "./quiz.service.js";
import { ProctoringService } from "./proctoring.service.js";
import logger from "../../config/logger.js";
import { 
    ViolationPayload, 
    AnswerPayload, 
    SubmitPayload,
    JoinPayload 
} from "./quiz.types.js";

export class QuizGateway {
    server!: Server;

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
    }

    async handleConnection(socket: Socket) {
        const { participantId, contestId } = socket.data;
        logger.info(`[QuizGateway] Participant ${participantId} connected to socket ${socket.id}`);
        await socket.join(`contest:${contestId}`);
        await socket.join(`participant:${participantId}`);
    }

    async handleDisconnect(socket: Socket) {
        const { participantId, contestId } = socket.data;
        logger.info(`[QuizGateway] Participant ${participantId} disconnected`);
    }

    async handleJoin(socket: Socket, payload: JoinPayload) {
        const { participantId, contestId } = socket.data;
        const result = await this.quizService.joinWaitingRoom(contestId, participantId);
        
        socket.emit("quiz:v1:waiting_room_status", result);
        
        this.server.of("/quiz-admin").to(`admin:${contestId}`).emit("admin:v1:participant_joined", {
            participantId,
            timestamp: new Date().toISOString()
        });
    }

    async handleHeartbeat(socket: Socket) {
        const { participantId, contestId } = socket.data;
        await this.quizService.handleHeartbeat(contestId, participantId);
    }

    async handleAnswer(socket: Socket, payload: AnswerPayload) {
        const { participantId, contestId } = socket.data;
        const success = await this.quizService.saveAnswer(
            contestId,
            participantId,
            payload.questionId,
            payload.selectedOptionId,
            payload.answeredAt
        );

        if (success) {
            socket.emit("quiz:v1:answer_saved", { questionId: payload.questionId });
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

        this.server.of("/quiz-admin").to(`admin:${contestId}`).emit("admin:v1:violation_alert", {
            participantId,
            violation: payload.type,
            count: result.totalViolations,
            timestamp: new Date().toISOString()
        });
    }

    async handleSubmit(socket: Socket, payload: SubmitPayload) {
        const { participantId, contestId } = socket.data;
        const result = await this.quizService.submitQuiz(contestId, participantId, "MANUAL");
        socket.emit("quiz:v1:submit_success", result);
    }

    // ─── Worker Integration Methods ───────────────────────────────────────────

    async startQuizForParticipant(pid: string, cid: string, oid: string, contactId: string) {
        try {
            const result = await this.quizService.startQuiz(cid, oid, pid, contactId, "worker-trigger");
            this.server.of("participant").to(`participant:${pid}`).emit("quiz:v1:start", result);
        } catch (err) {
            logger.error(`[QuizGateway] Failed to start quiz for ${pid}: ${err}`);
        }
    }

    emitTimeWarning(cid: string, seconds: number) {
        this.server.of("participant").to(`contest:${cid}`).emit("quiz:v1:time_warning", { secondsRemaining: seconds });
    }

    async emitAutoSubmit(pid: string, cid: string, reason: string) {
        try {
            const result = await this.quizService.submitQuiz(cid, pid, "AUTO");
            this.server.of("participant").to(`participant:${pid}`).emit("quiz:v1:auto_submit", {
                reason,
                submissionRef: result.submissionRef
            });
        } catch (err) {
            logger.error(`[QuizGateway] Failed to auto-submit for ${pid}: ${err}`);
        }
    }

    async emitCaptureRequest(pid: string, captureType: string) {
        this.server.of("participant").to(`participant:${pid}`).emit("quiz:v1:capture_request", { captureType });
    }

    broadcastAdminEvent(cid: string, event: string, data: unknown) {
        this.server.of("/quiz-admin").to(`admin:${cid}`).emit(event, data);
    }
}
