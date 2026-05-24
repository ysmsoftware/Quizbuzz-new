import rateLimit from 'express-rate-limit';
import { config } from '../../../config';
import { Router } from 'express';
import { adminAuthController } from '../../../container';
import { authenticatedOrgMiddleware } from '../../../middlewares/authenticated-org.middleware';

const loginLimiter = rateLimit({
    windowMs: config.rateLimit.window,
    max: config.rateLimit.max,
    message: {
        success: false,
        message: "Too many attempts. Please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
})

const globalLimiter = rateLimit({
    windowMs: config.rateLimit.window,
    max: config.rateLimit.max,
    message: {
        success: false,
        message: "Too many attempts.",
    },
    standardHeaders: true,
    legacyHeaders: false,
})

export const adminAuthRouter = Router();

// public rotues
adminAuthRouter.post("/register", adminAuthController.register);
adminAuthRouter.post("/login", adminAuthController.login);
adminAuthRouter.post("/refresh", adminAuthController.refresh);
adminAuthRouter.post("/verify-email", adminAuthController.verifyEmail);
adminAuthRouter.post("/resend-verification", loginLimiter, adminAuthController.resendVerification);
adminAuthRouter.post("/forgot-password", loginLimiter, adminAuthController.forgotPassword);
adminAuthRouter.post("/reset-password", loginLimiter, adminAuthController.resetPassword);

// Protected routes (require valid access token + org in JWT)
adminAuthRouter.post("/logout", authenticatedOrgMiddleware, adminAuthController.logout);
adminAuthRouter.post("/logout-all", authenticatedOrgMiddleware, adminAuthController.logoutAll);
adminAuthRouter.get("/me", authenticatedOrgMiddleware, adminAuthController.getMe);
adminAuthRouter.post("/switch-org", authenticatedOrgMiddleware, adminAuthController.switchOrg);
adminAuthRouter.get("/socket-token", authenticatedOrgMiddleware, adminAuthController.getSocketToken);