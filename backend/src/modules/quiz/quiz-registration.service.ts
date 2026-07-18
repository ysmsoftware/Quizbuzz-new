/**
 * Quiz Registration Auth Service
 *
 * Handles the public OTP flow that lets participants prove their email
 * address before registering for a contest.
 *
 * Flow:
 *   1. requestOtp(email)  → generate OTP, store in Redis, send via email
 *   2. verifyOtp(email, otp) → verify OTP, return a short-lived contactToken JWT
 *
 * The contactToken is then included in the body of
 *   POST /contests/register/:contestSlug
 * where ContestService.registerParticipant() verifies it.
 *
 * NOTE: This is intentionally separate from QuizAuthService, which handles
 * the multi-step auth (contactToken → OTP → joinCode) for entering a LIVE
 * quiz room over WebSocket. That flow requires an existing participant record;
 * this flow happens before the participant record exists.
 */

import { redis } from "../../config/redis";
import { config } from "../../config";
import logger from "../../config/logger";
import { createContactToken } from "../../utils/tokens";
import { generateotp, hashOtp, compareOtp } from "../../utils/otp";
import { EmailProvider } from "../../providers/email.provider";
import { MessageTemplate } from "../../types/message-template.enum";

// ─── Constants ────────────────────────────────────────────────────────────────

const OTP_TTL = config.redis.ttl.otp;         // seconds (e.g. 300)
const MAX_ATTEMPTS = config.auth.otp.maxAttempts;   // e.g. 5

function regOtpKey(email: string): string {
    return `auth:reg:otp:${email.toLowerCase()}`;
}

// ─── Custom error ─────────────────────────────────────────────────────────────

export class RegistrationAuthError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "RegistrationAuthError";
    }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class QuizRegistrationService {
    constructor(private readonly emailProvider: EmailProvider) { }

    async requestOtp(email: string): Promise<void> {
        const otp = generateotp();
        const hash = hashOtp(otp);
        const key = regOtpKey(email);

        await redis.hset(key, { hash, attempts: "0" });
        await redis.expire(key, OTP_TTL);

        if (config.app.nodeEnv !== "production") {
            logger.info(`[reg-auth] OTP for ${email}: ${otp}`);
        }

        this.emailProvider
            .send(MessageTemplate.OTP_VERIFICATION_CODE, email, {
                name: email,
                otp,
            })
            .catch((err: Error) => {
                logger.error(`[reg-auth] Failed to send OTP email to ${email}: ${err.message}`);
            });
    }
    async verifyOtp(email: string, otp: string): Promise<{ contactToken: string; expiresIn: number }> {
        const key = regOtpKey(email);
        const stored = await redis.hgetall(key);

        if (!stored.hash) {
            throw new RegistrationAuthError(
                "OTP_EXPIRED",
                "OTP has expired or was never requested. Please request a new one.",
            );
        }

        const attempts = parseInt(stored.attempts ?? "0", 10);

        if (attempts >= MAX_ATTEMPTS) {
            await redis.del(key);
            throw new RegistrationAuthError(
                "OTP_MAX_ATTEMPTS",
                "Too many incorrect attempts. Please request a new OTP.",
            );
        }

        await redis.hincrby(key, "attempts", 1);

        if (!compareOtp(otp, stored.hash)) {
            const remaining = MAX_ATTEMPTS - attempts - 1;
            throw new RegistrationAuthError(
                "OTP_INVALID",
                remaining > 0
                    ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
                    : "Invalid OTP. No attempts remaining — please request a new code.",
            );
        }

        await redis.del(key);

        logger.info(`[reg-auth] OTP verified for ${email}`);

        const contactToken = createContactToken({ email, organizationId: "" });
        const expiresIn = config.auth.jwt.contactTtl; // seconds

        return { contactToken, expiresIn };
    }
}
