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
import { logAudit } from "../../common/audit-log";

// Redis key used by QuizRegistrationService for registration OTPs.
// Must stay in sync with quiz-registration.service.ts → regOtpKey()
const regOtpKey = (email: string) => `auth:reg:otp:${email.toLowerCase()}`;

const OTP_TTL = config.redis.ttl.otp;            // 300s
const MAX_OTP_ATTEMPTS = config.auth.otp.maxAttempts;   // 5

// ── TEMPORARY diagnostic cache for participantLogin (load-test investigation,
// see load-testing/LOAD_TEST_INCIDENT_REPORT.md §1e) ────────────────────────
// Database Insights showed participantLogin's participant+contact lookup
// dominating DB CPU (99% of a 17-AAS spike, ~2vCPU instance) during a join
// burst — not because the query is slow (it's index-covered, sub-ms in
// isolation) but because ~100-150 near-simultaneous logins each fire it at
// once. This bulk-prefetches the whole contest roster into one Redis hash on
// the first login request, so every login after that is a Redis HGET instead
// of a Postgres round-trip — trading N concurrent queries for 1.
//
// CORRECTNESS CAVEAT: this snapshots status at warm time. A participant
// disqualified (or otherwise transitioned) AFTER the cache warms will still
// read their pre-disqualification status until the entry expires. Acceptable
// for this load-test experiment; NOT safe to leave running against a real
// contest without also invalidating/refreshing the cached entry wherever
// participant status is written (participant.repository.ts's updateStatus/
// disqualify) — not done here since this is meant to be reverted once the
// experiment answers whether this endpoint is the bottleneck.
const LOGIN_CACHE_TTL_SEC = 4 * 60 * 60; // 4h — comfortably covers pre-join window + a ~1h quiz

type LoginCacheEntry = { participantId: string; status: string; firstName: string | null };

function loginCacheKey(contestId: string): string {
    return `quiz:${contestId}:login-cache`;
}

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
        deviceId?: string,
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
                proctoringEnabled: true,
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
            const sessionToken = this.createSessionToken(participant.id, contest.id, organizationId, deviceId);
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
                proctoringEnabled: contest.proctoringEnabled ?? true,
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
        const sessionToken = this.createSessionToken(participant.id, contest.id, organizationId, deviceId);

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
            proctoringEnabled: contest.proctoringEnabled ?? true,
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

        // Use isFullyAuthenticated so the camera check respects the per-contest
        // proctoringEnabled flag — direct readiness.camera check would bypass it.
        const allComplete = await this.isFullyAuthenticated(participantId, contestId, true);

        logger.info(`[quiz-auth] Join code verified for participant ${participantId}`);
        return { verified: true, allComplete };
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    async isFullyAuthenticated(participantId: string, contestId: string, joinCodeRequired?: boolean): Promise<boolean> {
        if (joinCodeRequired === undefined) {
            joinCodeRequired = await this.isJoinCodeRequired(contestId);
        }
        const readiness = await this.sessionRepo.getReadiness(contestId, participantId);

        // Camera check is bypassed only when this specific contest has
        // proctoringEnabled = false. The global ENABLE_PROCTORING flag is
        // intentionally NOT used here — proctoring is now a per-contest
        // setting, not a platform-wide toggle. The global flag only controls
        // whether violation events are recorded (see quiz.gateway.ts).
        const contestProctoringEnabled = await this.isContestProctoringEnabled(contestId);
        const cameraOk = !contestProctoringEnabled || readiness.camera;

        return readiness.otp && cameraOk && (joinCodeRequired ? readiness.joincode : true);
    }

    private async isContestProctoringEnabled(contestId: string): Promise<boolean> {
        const contest = await this.prisma.contest.findUnique({
            where: { id: contestId },
            select: { proctoringEnabled: true },
        });
        return contest?.proctoringEnabled ?? true;
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

    private createSessionToken(participantId: string, contestId: string, organizationId: string, deviceId?: string): string {
        return jwt.sign(
            { participantId, contestId, organizationId, deviceId },
            config.auth.jwt.accessSecret,
            { expiresIn: config.redis.ttl.socketToken },
        );
    }

    verifySessionToken(token: string): { participantId: string; contestId: string; organizationId: string; deviceId?: string } {
        return jwt.verify(token, config.auth.jwt.accessSecret) as {
            participantId: string;
            contestId: string;
            organizationId: string;
            deviceId?: string;
        };
    }

    // ─── Participant Login (Quiz Join) ────────────────────────────────────────
    // Called by POST /auth/quiz/participant-login.
    // Verifies the OTP that was sent by QuizRegistrationService.requestOtp,
    // then looks up the participant record and issues a sessionToken for the
    // WebSocket connection. Keeps a single OTP step for quiz entry UX.

    async participantLogin(
        email: string,
        otp?: string,
        contestSlug?: string,
        contestId?: string,
        joinCode?: string,
        deviceId?: string,
    ): Promise<{ sessionToken: string; participantId: string; contestId: string; organizationId: string; proctoringEnabled: boolean; firstName: string | null }> {
        // OTP verification is bypassed/removed since the email identity is already verified during registration.
        const normalizedEmail = email.toLowerCase();

        // 1. Resolve contest by slug/id (accept LIVE, PUBLISHED, REGISTRATION_CLOSED)
        const contest = await this.prisma.contest.findFirst({
            where: {
                OR: [
                    ...(contestId ? [{ id: contestId }] : []),
                    ...(contestSlug ? [{ slug: contestSlug }] : []),
                ],
                status: { in: ["LIVE", "PUBLISHED", "REGISTRATION_CLOSED"] },
                isDeleted: false,
            },
            select: { id: true, organizationId: true, startTime: true, endTime: true, joinCode: true, proctoringEnabled: true },
        });

        if (!contest) {
            throw new QuizAuthError("CONTEST_NOT_FOUND", "Contest not found or not currently accepting participants");
        }

        // 2. Verify joinCode if contest requires one
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

        // 3. Resolve contact + participant — Redis-first (see LOGIN_CACHE_TTL_SEC
        // comment above), falling back to the original combined-query DB path on
        // any cache miss so correctness never depends on the cache being warm.
        let participant: { id: string; status: string; contact: { firstName: string | null } } | null = null;

        const cacheKey = loginCacheKey(contest.id);
        const cached = await redis.hget(cacheKey, normalizedEmail);
        if (cached) {
            const entry: LoginCacheEntry = JSON.parse(cached);
            participant = { id: entry.participantId, status: entry.status, contact: { firstName: entry.firstName } };
        } else {
            // Cache not warm (or this email isn't in it) — warm it once per
            // contest so the NEXT ~150 concurrent logins hit Redis instead of
            // Postgres. A brief race where a few concurrent requests all miss
            // and each trigger a warm is fine here (bulk query, cheap) — the
            // whole point is avoiding N individual per-participant queries.
            const warmed = await redis.set(`${cacheKey}:warming`, "1", "EX", 20, "NX");
            if (warmed) {
                await this.warmLoginCache(contest.id, contest.organizationId);
            }
            const cachedAfterWarm = await redis.hget(cacheKey, normalizedEmail);
            if (cachedAfterWarm) {
                const entry: LoginCacheEntry = JSON.parse(cachedAfterWarm);
                participant = { id: entry.participantId, status: entry.status, contact: { firstName: entry.firstName } };
            } else {
                // Genuine miss (not registered, or lost a warm-lock race and the
                // warming request hasn't finished yet) — fall back to the DB,
                // exactly as before this cache existed.
                participant = await this.prisma.participant.findFirst({
                    where: {
                        contestId: contest.id,
                        organizationId: contest.organizationId,
                        contact: { email: normalizedEmail, organizationId: contest.organizationId },
                        status: { in: ["REGISTERED", "CHECKED_IN", "IN_WAITING", "IN_QUIZ", "SUBMITTED"] },
                    },
                    select: { id: true, status: true, contact: { select: { firstName: true } } },
                });
            }
        }

        if (!participant) {
            const contact = await this.prisma.contact.findFirst({
                where: { email: normalizedEmail, organizationId: contest.organizationId },
                select: { id: true },
            });
            if (!contact) {
                throw new QuizAuthError("CONTACT_NOT_FOUND", "No account found for this email address");
            }
            throw new QuizAuthError("NOT_REGISTERED", "You are not registered for this contest");
        }

        // Participant already submitted — let the frontend show a "you already submitted" screen
        // rather than allowing them back into the quiz flow.
        if (participant.status === "SUBMITTED") {
            throw new QuizAuthError("ALREADY_SUBMITTED", "You have already submitted this quiz. Your answers have been recorded.");
        }

        // 4. Issue session token scoped to this participant + contest
        const sessionToken = this.createSessionToken(participant.id, contest.id, contest.organizationId, deviceId);

        logger.info(`[quiz-auth] participantLogin: participant ${participant.id} authenticated for contest ${contest.id}`);

        logAudit({
            action: "auth.participant_login",
            targetType: "PARTICIPANT",
            targetId: participant.id,
            targetLabel: email,
            organizationId: contest.organizationId,
            actorId: participant.id,
            actorType: "PARTICIPANT",
            actorLabel: email,
        });

        return {
            sessionToken,
            participantId: participant.id,
            contestId: contest.id,
            organizationId: contest.organizationId,
            proctoringEnabled: contest.proctoringEnabled ?? true,
            // Surfaced so the waiting room can greet the participant by name
            // instead of showing the long, non-human-readable participant ID.
            firstName: participant.contact?.firstName ?? null,
        };
    }

    // See LOGIN_CACHE_TTL_SEC comment at the top of this file — TEMPORARY
    // diagnostic cache, one bulk query replacing N concurrent per-login ones.
    private async warmLoginCache(contestId: string, organizationId: string): Promise<void> {
        const participants = await this.prisma.participant.findMany({
            where: {
                contestId,
                organizationId,
                status: { in: ["REGISTERED", "CHECKED_IN", "IN_WAITING", "IN_QUIZ", "SUBMITTED"] },
            },
            select: {
                id: true,
                status: true,
                contact: { select: { email: true, firstName: true } },
            },
        });

        if (participants.length === 0) return;

        const cacheKey = loginCacheKey(contestId);
        const pipeline = redis.pipeline();
        for (const p of participants) {
            if (!p.contact?.email) continue;
            const entry: LoginCacheEntry = { participantId: p.id, status: p.status, firstName: p.contact.firstName };
            pipeline.hset(cacheKey, p.contact.email.toLowerCase(), JSON.stringify(entry));
        }
        pipeline.expire(cacheKey, LOGIN_CACHE_TTL_SEC);
        await pipeline.exec();

        logger.info(`[quiz-auth] Warmed login cache for contest ${contestId}: ${participants.length} participants`);
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
