import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { QuizRegistrationService, RegistrationAuthError } from "./quiz-registration.service";

// ─── Request validators ───────────────────────────────────────────────────────

const RequestOtpSchema = z.object({
    email: z.string().email("Please provide a valid email address").toLowerCase(),
});

const VerifyOtpSchema = z.object({
    email: z.string().email().toLowerCase(),
    otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
});

// ─── Controller ───────────────────────────────────────────────────────────────

export class QuizRegistrationController {
    constructor(private readonly service: QuizRegistrationService) {}

    /**
     * POST /auth/quiz/request-otp
     * Public — no auth required.
     */
    requestOtp = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email } = RequestOtpSchema.parse(req.body);
            await this.service.requestOtp(email);

            res.status(200).json({
                success: true,
                message: "OTP sent to your email",
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    /**
     * POST /auth/quiz/verify-otp
     * Public — no auth required.
     */
    verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, otp } = VerifyOtpSchema.parse(req.body);
            const result = await this.service.verifyOtp(email, otp);

            res.status(200).json({
                success: true,
                message: "OTP verified",
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            // Map domain errors to clean HTTP responses
            if (err instanceof RegistrationAuthError) {
                const statusMap: Record<string, number> = {
                    OTP_EXPIRED:      400,
                    OTP_INVALID:      400,
                    OTP_MAX_ATTEMPTS: 429,
                };
                res.status(statusMap[err.code] ?? 400).json({
                    success: false,
                    code:    err.code,
                    message: err.message,
                    requestId: (req as any).id,
                });
                return;
            }
            next(err);
        }
    };
}
