import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../../config";
import { quizRegistrationController } from "../../container";

// 5 OTP requests per window per IP (driven by RATE_LIMIT_OTP env var)
const otpLimiter = rateLimit({
    windowMs: config.rateLimit.window,
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
quizRegistrationRouter.post("/request-otp", otpLimiter, quizRegistrationController.requestOtp);
quizRegistrationRouter.post("/verify-otp",  otpLimiter, quizRegistrationController.verifyOtp);
quizRegistrationRouter.post("/participant-login", otpLimiter, quizRegistrationController.participantLogin);
