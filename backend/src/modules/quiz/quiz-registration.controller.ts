import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { QuizRegistrationService, RegistrationAuthError } from "./quiz-registration.service";
import { QuizAuthService, QuizAuthError } from "./quiz-auth.service";

// ─── Request validators ───────────────────────────────────────────────────────

const RequestOtpSchema = z.object({
    email: z.string().email("Please provide a valid email address").toLowerCase(),
});

const VerifyOtpSchema = z.object({
    email: z.string().email().toLowerCase(),
    otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
});

const ParticipantLoginSchema = z.object({
    email: z.string().email("Please provide a valid email address").toLowerCase(),
    otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric").optional(),
    contestSlug: z.string().min(1).optional(),
    contestId: z.string().min(1).optional(),
    joinCode: z.string().min(1).optional(),
});

// ─── Controller ───────────────────────────────────────────────────────────────

export class QuizRegistrationController {
    constructor(
        private readonly service: QuizRegistrationService,
        private readonly quizAuthService: QuizAuthService,
    ) {}

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
     * Returns a contactToken (for the registration flow, Wave 4).
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

    /**
     * POST /auth/quiz/participant-login
     * Public — no auth required.
     *
     * Combines OTP verification + participant lookup + sessionToken issuance
     * in a single call. Used by the quiz join page (Wave 6) after the
     * participant has already called /request-otp.
     *
     * Returns { sessionToken, participantId, contestId, organizationId }
     * The sessionToken is passed as socket.handshake.auth.token when
     * connecting to the /participant WebSocket namespace.
     */
    participantLogin = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, otp, contestSlug, contestId, joinCode } = ParticipantLoginSchema.parse(req.body);
            const result = await this.quizAuthService.participantLogin(email, otp, contestSlug, contestId, joinCode);

            res.status(200).json({
                success: true,
                message: "Authenticated successfully",
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            if (err instanceof QuizAuthError) {
                const statusMap: Record<string, number> = {
                    OTP_EXPIRED:        400,
                    OTP_INVALID:        400,
                    OTP_MAX_ATTEMPTS:   429,
                    CONTEST_NOT_FOUND:  404,
                    CONTEST_ENDED:      410,
                    CONTACT_NOT_FOUND:  404,
                    NOT_REGISTERED:     403,
                    ALREADY_SUBMITTED:  409,
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
