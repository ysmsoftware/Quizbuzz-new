/**
 * Quiz Auth Service
 *
 * Handles the multi-step identity verification flow for quiz entry:
 *   1. Authenticate participant via contactToken JWT
 *   2. Send & verify OTP (6-digit)
 *   3. Verify join code (if contest requires one)
 *
 * On successful completion of all steps, participant is eligible
 * to enter the waiting room.
 */

import { redis } from "../../config/redis";
import { config } from "../../config";
import logger from "../../config/logger";
import { verifyContactToken } from "../../utils/tokens";
import { generateotp, hashOtp, compareOtp, otpKey } from "../../utils/otp";
import { QuizSession } from "./quiz.session";
import type { QuizAuthResult, AuthStep } from "./quiz.types";
import type { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { MessagingService } from "../messaging/messaging.service";
import { MessageTemplate } from "../../types/message-template.enum";

// Redis key used by QuizRegistrationService for registration OTPs.
// Must stay in sync with quiz-registration.service.ts → regOtpKey()
const regOtpKey = (email: string) => `auth:reg:otp:${email.toLowerCase()}`;

const OTP_TTL = config.redis.ttl.otp;            // 300s
const MAX_OTP_ATTEMPTS = config.auth.otp.maxAttempts;   // 5

export class QuizAuthService {
    constructor(
        private prisma: PrismaClient,
        private sessionRepo: QuizSession,
        private messagingService: MessagingService,
    ) { }

    // ─── Step 1: Authenticate participant identity ────────────────────────────

    async authenticateParticipant(
        contestSlug: string,
        contactToken: string,
    ): Promise<QuizAuthResult> {
        // 1. Verify JWT
        const tokenPayload = await verifyContactToken(contactToken);
        const { email, organizationId } = tokenPayload;

        // 2. Resolve contest by slug + org
        const contest = await this.prisma.contest.findFirst({
            where: {
                slug: contestSlug,
                organizationId,
                status: { in: ["LIVE", "PUBLISHED"] },
            },
            select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                duration: true,
                joinCode: true,
                status: true,
            },
        });

        if (!contest) {
            throw new QuizAuthError("CONTEST_NOT_FOUND", "Contest not found or not active");
        }

        // Allow entry up to 15 min before startTime for PUBLISHED contests
        const now = new Date();
        const preJoinWindow = new Date(contest.startTime.getTime() - 15 * 60 * 1000);

        if (contest.status === "PUBLISHED" && now < preJoinWindow) {
            throw new QuizAuthError(
                "CONTEST_NOT_STARTED",
                `Contest opens at ${preJoinWindow.toISOString()}`,
            );
        }

        if (now > contest.endTime) {
            throw new QuizAuthError("CONTEST_ENDED", "This contest has ended");
        }

        // 3. Resolve contact → participant
        const contact = await this.prisma.contact.findFirst({
            where: { email, organizationId },
            select: { id: true, firstName: true },
        });

        if (!contact) {
            throw new QuizAuthError("CONTACT_NOT_FOUND", "No registration found for this email");
        }

        const participant = await this.prisma.participant.findFirst({
            where: {
                contactId: contact.id,
                contestId: contest.id,
                organizationId,
                status: {
                    in: ["REGISTERED", "CHECKED_IN", "IN_WAITING", "IN_QUIZ"],
                },
            },
            select: { id: true, status: true },
        });

        if (!participant) {
            throw new QuizAuthError(
                "NOT_REGISTERED",
                "You are not registered for this contest",
            );
        }

        // 4. Check for existing session (reconnection scenario)
        const existingSession = await this.sessionRepo.getSession(contest.id, participant.id);
        if (existingSession && existingSession.phase === "IN_QUIZ") {
            // This is a reconnect — skip auth steps, return session token
            const sessionToken = this.createSessionToken(participant.id, contest.id, organizationId);
            return {
                participantId: participant.id,
                contactId: contact.id,
                contestId: contest.id,
                organizationId,
                sessionToken,
                requiredSteps: [], // no steps needed for reconnect
                contestTitle: contest.title,
                contestStartTime: contest.startTime.toISOString(),
                contestEndTime: contest.endTime.toISOString(),
                contestDuration: contest.duration,
                joinCodeRequired: false,
            };
        }

        // 5. Determine required auth steps
        const requiredSteps: AuthStep[] = ["otp"];
        if (contest.joinCode) {
            requiredSteps.push("joincode");
        }

        // 6. Generate and store OTP
        const otp = generateotp();
        const hash = hashOtp(otp);
        const otpRedisKey = otpKey(contact.id, "QUIZ_AUTH");

        await redis.hset(otpRedisKey, { hash, attempts: "0" });
        await redis.expire(otpRedisKey, OTP_TTL);

        // 7. Send OTP via messaging queue (fire-and-forget)
        logger.info(`[quiz-auth] OTP generated for participant ${participant.id}: ${otp}`);
        this.messagingService.enqueueMessage(organizationId, {
            participantId: participant.id,
            contestId: contest.id,
            channel: "EMAIL",
            template: MessageTemplate.OTP_VERIFICATION_CODE,
            recipient: email,
            params: { name: contact.firstName ?? email, otp },
        }).catch((err) => {
            logger.error(`[quiz-auth] Failed to enqueue OTP: ${(err as Error).message}`);
        });

        // 8. Create session token
        const sessionToken = this.createSessionToken(participant.id, contest.id, organizationId);

        return {
            participantId: participant.id,
            contactId: contact.id,
            contestId: contest.id,
            organizationId,
            sessionToken,
            requiredSteps,
            contestTitle: contest.title,
            contestStartTime: contest.startTime.toISOString(),
            contestEndTime: contest.endTime.toISOString(),
            contestDuration: contest.duration,
            joinCodeRequired: !!contest.joinCode,
        };
    }

    // ─── Step 2: Verify OTP ───────────────────────────────────────────────────

    async verifyOtp(
        participantId: string,
        contactId: string,
        otp: string,
        contestId?: string,
    ): Promise<{ verified: boolean; allComplete: boolean }> {
        const redisKey = otpKey(contactId, "QUIZ_AUTH");
        const stored = await redis.hgetall(redisKey);

        if (!stored.hash) {
            throw new QuizAuthError("OTP_EXPIRED", "OTP has expired. Please request a new one.");
        }

        // Rate limit
        const attempts = parseInt(stored.attempts || "0", 10);
        if (attempts >= MAX_OTP_ATTEMPTS) {
            await redis.del(redisKey);
            throw new QuizAuthError("OTP_MAX_ATTEMPTS", "Too many attempts. Please request a new OTP.");
        }

        await redis.hincrby(redisKey, "attempts", 1);

        // Compare
        if (!compareOtp(otp, stored.hash)) {
            throw new QuizAuthError("OTP_INVALID", `Invalid OTP. ${MAX_OTP_ATTEMPTS - attempts - 1} attempts remaining.`);
        }

        const contestIdResolved = contestId ?? await this.resolveContestIdForParticipant(participantId);
        if (!contestIdResolved) {
            throw new QuizAuthError("PARTICIPANT_NOT_FOUND", "Participant not found");
        }

        // Success — mark OTP step complete
        await redis.del(redisKey);
        await this.sessionRepo.setReadiness(contestIdResolved, participantId, "otp", true);

        // Check if fully authenticated
        const joinCodeRequired = await this.isJoinCodeRequired(contestIdResolved);
        const allComplete = await this.isFullyAuthenticated(participantId, contestIdResolved, joinCodeRequired);

        logger.info(`[quiz-auth] OTP verified for participant ${participantId}`);
        return { verified: true, allComplete };
    }

    // ─── Step 3: Verify Join Code ─────────────────────────────────────────────

    async verifyJoinCode(
        participantId: string,
        contestId: string,
        joinCode: string,
    ): Promise<{ verified: boolean; allComplete: boolean }> {
        const contest = await this.prisma.contest.findUnique({
            where: { id: contestId },
            select: { joinCode: true },
        });

        if (!contest?.joinCode) {
            throw new QuizAuthError("JOINCODE_NOT_REQUIRED", "This contest does not require a join code");
        }

        if (contest.joinCode.toLowerCase() !== joinCode.toLowerCase()) {
            throw new QuizAuthError("JOINCODE_INVALID", "Invalid join code");
        }

        await this.sessionRepo.setReadiness(contestId, participantId, "joincode", true);

        const readiness = await this.sessionRepo.getReadiness(contestId, participantId);
        const allComplete = readiness.otp && readiness.camera && readiness.joincode;

        logger.info(`[quiz-auth] Join code verified for participant ${participantId}`);
        return { verified: true, allComplete };
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    async isFullyAuthenticated(participantId: string, contestId: string, joinCodeRequired?: boolean): Promise<boolean> {
        if (joinCodeRequired === undefined) {
            joinCodeRequired = await this.isJoinCodeRequired(contestId);
        }
        const readiness = await this.sessionRepo.getReadiness(contestId, participantId);
        return readiness.otp && readiness.camera && (joinCodeRequired ? readiness.joincode : true);
    }

    private async isJoinCodeRequired(contestId: string): Promise<boolean> {
        const contest = await this.prisma.contest.findUnique({
            where: { id: contestId },
            select: { joinCode: true },
        });
        return !!contest?.joinCode;
    }

    private async resolveContestIdForParticipant(participantId: string): Promise<string | null> {
        const participant = await this.prisma.participant.findUnique({
            where: { id: participantId },
            select: { contestId: true },
        });
        return participant?.contestId ?? null;
    }

    private createSessionToken(participantId: string, contestId: string, organizationId: string): string {
        return jwt.sign(
            { participantId, contestId, organizationId },
            config.auth.jwt.accessSecret,
            { expiresIn: config.redis.ttl.socketToken },
        );
    }

    verifySessionToken(token: string): { participantId: string; contestId: string; organizationId: string } {
        return jwt.verify(token, config.auth.jwt.accessSecret) as {
            participantId: string;
            contestId: string;
            organizationId: string;
        };
    }

    // ─── Participant Login (Quiz Join) ────────────────────────────────────────
    // Called by POST /auth/quiz/participant-login.
    // Verifies the OTP that was sent by QuizRegistrationService.requestOtp,
    // then looks up the participant record and issues a sessionToken for the
    // WebSocket connection. Keeps a single OTP step for quiz entry UX.

    async participantLogin(
        email: string,
        otp: string,
        contestSlug?: string,
        contestId?: string,
        joinCode?: string,
    ): Promise<{ sessionToken: string; participantId: string; contestId: string; organizationId: string }> {
        // 1. Verify OTP stored under the registration Redis key
        const key = regOtpKey(email);
        const stored = await redis.hgetall(key);

        if (!stored.hash) {
            throw new QuizAuthError("OTP_EXPIRED", "OTP has expired. Please request a new one.");
        }

        const attempts = parseInt(stored.attempts || "0", 10);
        if (attempts >= MAX_OTP_ATTEMPTS) {
            await redis.del(key);
            throw new QuizAuthError("OTP_MAX_ATTEMPTS", "Too many incorrect attempts. Please request a new OTP.");
        }

        await redis.hincrby(key, "attempts", 1);

        if (!compareOtp(otp, stored.hash)) {
            const remaining = MAX_OTP_ATTEMPTS - attempts - 1;
            throw new QuizAuthError(
                "OTP_INVALID",
                remaining > 0
                    ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
                    : "Invalid OTP. No attempts remaining — please request a new code.",
            );
        }

        // OTP verified — consume it immediately
        await redis.del(key);

        // 2. Resolve contest by slug/id (accept LIVE, PUBLISHED, REGISTRATION_CLOSED)
        const contest = await this.prisma.contest.findFirst({
            where: {
                OR: [
                    ...(contestId ? [{ id: contestId }] : []),
                    ...(contestSlug ? [{ slug: contestSlug }] : []),
                ],
                status: { in: ["LIVE", "PUBLISHED", "REGISTRATION_CLOSED"] },
                isDeleted: false,
            },
            select: { id: true, organizationId: true, startTime: true, endTime: true, joinCode: true },
        });

        if (!contest) {
            throw new QuizAuthError("CONTEST_NOT_FOUND", "Contest not found or not currently accepting participants");
        }

        // 3. Verify joinCode if contest requires one
        if (contest.joinCode) {
            if (!joinCode) {
                throw new QuizAuthError("JOINCODE_REQUIRED", "Join code is required for this contest");
            }
            if (contest.joinCode.toLowerCase() !== joinCode.toLowerCase()) {
                throw new QuizAuthError("JOINCODE_INVALID", "Invalid join code");
            }
        }

        if (new Date() > contest.endTime) {
            throw new QuizAuthError("CONTEST_ENDED", "This contest has already ended");
        }

        // 3. Resolve contact → participant
        const contact = await this.prisma.contact.findFirst({
            where: { email: email.toLowerCase(), organizationId: contest.organizationId },
            select: { id: true, firstName: true },
        });

        if (!contact) {
            throw new QuizAuthError("CONTACT_NOT_FOUND", "No account found for this email address");
        }

        const participant = await this.prisma.participant.findFirst({
            where: {
                contactId: contact.id,
                contestId: contest.id,
                organizationId: contest.organizationId,
                status: { in: ["REGISTERED", "CHECKED_IN", "IN_WAITING", "IN_QUIZ"] },
            },
            select: { id: true },
        });

        if (!participant) {
            throw new QuizAuthError("NOT_REGISTERED", "You are not registered for this contest");
        }

        // 4. Issue session token scoped to this participant + contest
        const sessionToken = this.createSessionToken(participant.id, contest.id, contest.organizationId);

        logger.info(`[quiz-auth] participantLogin: participant ${participant.id} authenticated for contest ${contest.id}`);

        return {
            sessionToken,
            participantId: participant.id,
            contestId: contest.id,
            organizationId: contest.organizationId,
        };
    }
}

export class QuizAuthError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "QuizAuthError";
    }
}
