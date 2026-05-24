import { Request, Response, NextFunction } from "express";
import { TokenPair } from "./admin-auth.types";
import { AdminAuthService } from "./admin-auth.service";
import { config } from "../../../config";
import { ForgotPasswordSchema, LoginAdminSchema, RegisterAdminSchema, ResendVerificationSchema, ResetPasswordSchema, SwitchOrgSchema, VerifyEmailSchema } from "./admin-auth.validator";

export class AdminAuthController {

    constructor(private readonly service: AdminAuthService) { }

    // helper 

    private getDevice(req: Request){
        return {
            ipAddress: (req.ip ?? req.socket.remoteAddress ?? "unknown"),
            userAgent: req.headers["user-agent"] ?? "unknown"
        }
    }

    private setCookies(res: Response, tokens: TokenPair): void {
        const { domain, secure, sameSite } = config.auth.cookie;

        res.cookie("accessToken", tokens.accessToken, {
            httpOnly: true,
            secure,
            sameSite: sameSite as any,
            domain: domain || undefined,
            maxAge: config.auth.jwt.accessTtl * 1000,
        });
        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            secure,
            sameSite: sameSite as any,
            domain: domain || undefined,
            path: "/api/v1/auth/admin/refresh",
            maxAge: config.auth.jwt.refreshTtl * 1000,
        });
    }

    private  clearCookies(res: Response): void {
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken", { path: "/api/v1/auth/admin/refresh" });
    }

    register = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = RegisterAdminSchema.parse(req.body);
            const result = await this.service.register(data);

            res.status(201).json({
                success: true,
                message: "Account created. Please verify your email",
                data: result,
                requestId: req.id,
            });
        } catch(err) {
            next(err);
        }
    }

    login = async(req: Request, res: Response, next: NextFunction) => {
        try {
            const data = LoginAdminSchema.parse(req.body);
            const device = this.getDevice(req);

            const result = await this.service.login(data, device);

            this.setCookies(res, result.tokens);

            res.status(200).json({
                success: true,
                message: "Login successful",
                data: result,
                requestId: req.id
            });


        } catch(err) {
            next(err);
        }
    }

    refresh = async(req: Request, res: Response, next: NextFunction) => {
        try {
            const rawRefreshToken = req.cookies?.refreshToken;
            if(!rawRefreshToken) {
                res.status(401).json({
                    success: false,
                    message: "No refresh token",
                    requestId: req.id,
                });
                return;
            }

            const device = this.getDevice(req);
            const tokens = await this.service.refresh(rawRefreshToken, device);

            this.setCookies(res, tokens);

            res.status(200).json({
                success: true,
                message: "Token refreshed",
                requestId: req.id,
            });


        } catch(err) {
            next(err);
        }
    }

    logout = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const rawRefreshToken = req.cookies?.refreshToken;
            if (rawRefreshToken) {
                await this.service.logout(rawRefreshToken);
            }
            this.clearCookies(res);
        
            res.status(200).json({
                success: true,
                message: "Logged out",
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    logoutAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.service.logoutAll(req.user!.id);
            this.clearCookies(res);
        
            res.status(200).json({
                success: true,
                message: "Logged out from all devices",
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    getMe = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.service.getMe(req.user!.id);
        
            res.status(200).json({
                success: true,
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    switchOrg = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { organizationId } = SwitchOrgSchema.parse(req.body);
            const device = this.getDevice(req);

            const result = await this.service.switchOrg(req.user!.id, organizationId, device);

            this.setCookies(res, result.tokens);

            res.status(200).json({
                success: true,
                message: "Switched to organization",
                data: result,
                requestId: req.id,
            });
        
        } catch (err) {
            next(err);
        }
    };

    verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, otp } = VerifyEmailSchema.parse(req.body);
            await this.service.verifyEmail(email, otp);

            res.status(200).json({
                success: true,
                message: "Email verified successfully",
                requestId: req.id,
            });
        
        } catch (err) {
            next(err);
        }
    }

    resendVerification = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email } = ResendVerificationSchema.parse(req.body);
            await this.service.resendVerificationOtp(email);
            res.status(200).json({
                success: true,
                message: "If that email has a pending verification, a new OTP has been sent.",
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    }

    forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email } = ForgotPasswordSchema.parse(req.body);
            await this.service.forgotPassword(email);
            
            res.status(200).json({
                success: true,
                message: "If that email exists, a reset link has been sent",
                requestId: req.id,
            });
        
        } catch (err) {
            next(err);
        }
    }

    resetPassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { token, newPassword } = ResetPasswordSchema.parse(req.body);
            await this.service.resetPassword(token, newPassword);

            res.status(200).json({
                success: true,
                message: "Password reset successful. Please login",
                request: req.id,
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * GET /auth/admin/socket-token
     * Returns a short-lived JWT the frontend uses to authenticate
     * the admin WebSocket connection (/quiz-admin namespace).
     * Protected by authenticatedOrgMiddleware (cookie-based).
     */
    getSocketToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = this.service.issueSocketToken(
                req.user!.id,
                req.user!.organizationId,
            );
            res.status(200).json({
                success: true,
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

}