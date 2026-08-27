import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { config } from "../../config";

function ctrl() { return require("../../container").quizRegistrationController; }

// Rate limiters on this router are keyed by participant email (from the
// request body) rather than by IP. IP-keying would break the common
// scenario of a quiz being run inside a college lab/lecture hall — many
// real participants sharing one NAT'd Wi-Fi IP — by rate-limiting the
// whole room as if it were one caller. Keying by email instead limits
// each participant individually and falls back to IP only when no email
// is present yet (e.g. a malformed/pre-validation request).
function emailKeyGenerator(req: import("express").Request): string {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";
    return email || ipKeyGenerator(req.ip ?? "");
}

// OTP requests/verification — abuse prevention (driven by RATE_LIMIT_OTP env var)
const otpLimiter = rateLimit({
    windowMs: config.rateLimit.window * 1000,
    max: config.rateLimit.otp,
    keyGenerator: emailKeyGenerator,
    message: {
        success: false,
        message: "Too many OTP requests. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// participant-login (quiz join) — a much higher, burst-shaped limit than
// the OTP limiter above. This endpoint has no OTP secret to guard (see
// QuizAuthService.participantLogin's comment: OTP is bypassed here since
// identity was already verified at registration), so its job isn't
// credential-stuffing prevention — it's shedding genuinely abnormal load
// in front of the DB reads participant-login makes. Sized generously
// (RATE_LIMIT_PARTICIPANT_LOGIN_MAX per RATE_LIMIT_PARTICIPANT_LOGIN_WINDOW,
// default 300/60s) so a normal join burst — a whole lab or lecture hall
// hitting "join" in the same couple of minutes — passes through untouched.
const participantLoginLimiter = rateLimit({
    windowMs: config.rateLimit.participantLogin.window * 1000,
    max: config.rateLimit.participantLogin.max,
    keyGenerator: emailKeyGenerator,
    message: {
        success: false,
        message: "Too many join attempts for this email. Please wait a moment and try again.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const quizRegistrationRouter = Router();

// Both routes are public — participants are not authenticated at this stage
quizRegistrationRouter.post("/request-otp",       otpLimiter,             (req, res, next) => ctrl().requestOtp(req, res, next));
quizRegistrationRouter.post("/verify-otp",        otpLimiter,             (req, res, next) => ctrl().verifyOtp(req, res, next));
quizRegistrationRouter.post("/participant-login", participantLoginLimiter, (req, res, next) => ctrl().participantLogin(req, res, next));
