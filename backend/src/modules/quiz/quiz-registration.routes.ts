import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../../config";

function ctrl() { return require("../../container").quizRegistrationController; }

// 5 OTP requests per window per IP (driven by RATE_LIMIT_OTP env var)
const otpLimiter = rateLimit({
    windowMs: config.rateLimit.window * 1000,
    max: config.rateLimit.otp,
    message: {
        success: false,
        message: "Too many OTP requests. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const quizRegistrationRouter = Router();

// Both routes are public — participants are not authenticated at this stage
quizRegistrationRouter.post("/request-otp",       (req, res, next) => ctrl().requestOtp(req, res, next));
quizRegistrationRouter.post("/verify-otp",        (req, res, next) => ctrl().verifyOtp(req, res, next));
quizRegistrationRouter.post("/participant-login", (req, res, next) => ctrl().participantLogin(req, res, next));
