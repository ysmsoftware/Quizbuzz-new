import { QuizSession } from "./quiz.session";
import { prisma } from "../../config/db";
import logger from "../../config/logger";
import {
    QuizSessionState,
    QuizSubmitResult,
    SavedAnswer
} from "./quiz.types";
import { ProctoringService } from "./proctoring.service";
import { SubmissionService } from "../submission/submission.service";
import { submissionQueue } from "../../queues";
import { buildSessionSeed, shuffleQuestionsForParticipant } from "../question/question.shuffle";

export class QuizService {
    constructor(
        private session: QuizSession,
        private proctoring: ProctoringService,
        private submissionService: SubmissionService
    ) { }

    /**
     * Handle participant joining the waiting room
     */
    async joinWaitingRoom(contestId: string, participantId: string): Promise<{
        participantCount: number;
        status: string;
    }> {
        logger.info(`[QuizService] Participant ${participantId} joining waiting room for contest ${contestId}`);

        // 1. Add to waiting set
        await this.session.addToWaitingRoom(contestId, participantId);

        // 2. Set initial phase to WAITING
        await this.session.updatePhase(contestId, participantId, "WAITING");

        // 3. Get total waiting count
        const count = await this.session.getWaitingCount(contestId);

        return {
            participantCount: count,
            status: "WAITING"
        };
    }

    /**
     * Heartbeat to track presence and session health
     */
    async handleHeartbeat(contestId: string, participantId: string): Promise<void> {
        await this.session.refreshHeartbeat(contestId, participantId);
    }

    /**
     * Start the quiz for a participant
     */
    async startQuiz(contestId: string, organizationId: string, participantId: string, contactId: string, socketId: string): Promise<{
        questions: any[];
        totalTimeMs: number;
        serverTimestamp: string;
    }> {
        // 1. Transition to IN_QUIZ
        await this.session.updatePhase(contestId, participantId, "IN_QUIZ");
        await this.session.removeFromWaitingRoom(contestId, participantId);
        await this.session.addToActive(contestId, participantId);

        // 2. Fetch contest data and questions in a single round trip
        const contest = await prisma.contest.findUnique({
            where: { id: contestId },
            select: {
                shuffleQuestions: true,
                shuffleOptions: true,
                duration: true,
                endTime: true,
                contestQuestions: {
                    orderBy: { position: 'asc' },
                    include: {
                        question: {
                            include: {
                                options: {
                                    select: { id: true, text: true, position: true, isCorrect: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!contest) {
            throw new Error(`[quiz-service] Contest ${contestId} not found`);
        }

        const contestQuestions = contest.contestQuestions;

        // Build session seed for deterministic shuffle
        const sessionSeed = buildSessionSeed(participantId, contestId);

        // Shuffle questions deterministically using seeded PRNG
        const shuffled = shuffleQuestionsForParticipant(
            contestQuestions,
            sessionSeed,
            contest.shuffleQuestions,
            contest.shuffleOptions
        );

        await this.session.saveQuestionOrder(contestId, participantId, shuffled.questions.map(q => q.id));

        const totalTimeMs = (contest.duration || 60) * 60 * 1000;

        // 3. Initialize session state in Redis
        await this.session.createSession({
            contestId,
            participantId,
            organizationId,
            contactId,
            socketId,
            phase: "IN_QUIZ",
            seed: sessionSeed,
            startedAt: new Date().toISOString(),
            currentQuestion: 0,
            totalQuestions: shuffled.questions.length,
            contestEndTime: contest.endTime.toISOString(),
            violationCount: 0,
            lastHeartbeatAt: new Date().toISOString()
        });

        return {
            questions: shuffled.questions,
            totalTimeMs,
            serverTimestamp: new Date().toISOString()
        };
    }

    /**
     * Persist an answer to Redis
     */
    async saveAnswer(
        contestId: string,
        participantId: string,
        questionId: string,
        selectedOptionId: string | null,
        answeredAt: string
    ): Promise<boolean> {
        const state = await this.session.getSession(contestId, participantId);
        if (state?.phase !== "IN_QUIZ") return false;

        await this.session.saveAnswer(contestId, participantId, questionId, {
            selectedOptionId,
            answeredAt
        });

        return true;
    }

    /**
     * Final submission of the quiz
     * Enqueues a submission job for async processing instead of creating a raw submission.
     * This ensures the entire pipeline runs: submission persistence → evaluation → leaderboard → certificates
     */
    async submitQuiz(
        contestId: string,
        participantId: string,
        reason: "MANUAL" | "AUTO" | "TIMEOUT"
    ): Promise<QuizSubmitResult> {
        const answers = await this.session.getAllAnswers(contestId, participantId);
        const state = await this.session.getSession(contestId, participantId);

        if (!state) {
            throw new Error(`[quiz-service] No session state found for participant ${participantId}`);
        }

        await this.session.updatePhase(contestId, participantId, "SUBMITTED");
        await this.session.removeFromActive(contestId, participantId);

        // Convert answers object to array format for submission job
        const answersArray = Object.entries(answers).map(([questionId, answer]) => ({
            questionId,
            selectedOptionId: (answer as SavedAnswer).selectedOptionId || null
        }));

        const timeTakenSecs = (new Date().getTime() - new Date(state.startedAt).getTime()) / 1000;
        const attemptedCount = answersArray.filter(a => a.selectedOptionId !== null).length;

        // Enqueue submission job for async processing
        const jobId = `${participantId}-${contestId}`;
        await submissionQueue.add(
            "persist-submission",
            {
                organizationId: state.organizationId,
                participantId,
                contestId,
                submittedAt: new Date().toISOString(),
                timeTakenSecs,
                source: reason === "MANUAL" ? "MANUAL" : "AUTO",
                totalQuestions: state.totalQuestions,
                attempted: attemptedCount,
                answers: answersArray
            },
            { jobId }
        );

        logger.info(
            `[quiz-service] Enqueued submission job for participant ${participantId} in contest ${contestId}`
        );

        return {
            submissionRef: jobId,
            timeTakenSecs,
            totalQuestions: state.totalQuestions,
            attempted: attemptedCount
        };
    }

    /**
     * Handle participant rejoining
     */
    async handleRejoin(contestId: string, participantId: string): Promise<any | null> {
        const state = await this.session.getSession(contestId, participantId);
        if (!state) return null;

        const answers = await this.session.getAllAnswers(contestId, participantId);
        const questions = await this.session.getQuestionOrder(contestId, participantId);

        return {
            phase: state.phase,
            questions,
            savedAnswers: answers,
            remainingTimeMs: state.contestEndTime ? new Date(state.contestEndTime).getTime() - new Date().getTime() : 0,
            serverTimestamp: new Date().toISOString()
        };
    }

    /**
     * Transition all waiting participants to quiz
     */
    async transitionToQuiz(contestId: string): Promise<{ transitioned: string[]; blocked: string[] }> {
        const waitingIds = await this.session.getActiveMembers(contestId, "waiting");
        const transitioned: string[] = [];
        const blocked: string[] = [];

        for (const pid of waitingIds) {
            // Check readiness (permission, OTP, etc. - in a real scenario we'd check more)
            const isReady = await this.session.getReadiness(contestId, pid);
            if (isReady.camera && isReady.otp) {
                transitioned.push(pid);
            } else {
                blocked.push(pid);
            }
        }

        return { transitioned, blocked };
    }

    /**
     * Force submit participants for a contest when time expires
     * Enqueues submission jobs for each participant.
     */
    async handleTimeExpiry(contestId: string): Promise<{ submitted: string[]; errors: any[] }> {
        const activeIds = await this.session.getActiveMembers(contestId, "active");
        const submitted: string[] = [];
        const errors: any[] = [];

        for (const pid of activeIds) {
            try {
                await this.submitQuiz(contestId, pid, "TIMEOUT");
                submitted.push(pid);
            } catch (err) {
                errors.push({ participantId: pid, error: String(err) });
            }
        }

        return { submitted, errors };
    }
}
