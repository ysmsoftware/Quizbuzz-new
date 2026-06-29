import rateLimit from 'express-rate-limit';
import { config } from '../../../config';
import { Router } from 'express';
import { authenticatedOrgMiddleware } from '../../../middlewares/authenticated-org.middleware';

function ctrl() { return require('../../../container').adminAuthController; }

const loginLimiter = rateLimit({
    windowMs: config.rateLimit.window,
    max: config.rateLimit.max,
    message: { success: false, message: "Too many attempts. Please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
})

const globalLimiter = rateLimit({
    windowMs: config.rateLimit.window,
    max: config.rateLimit.max,
    message: { success: false, message: "Too many attempts." },
    standardHeaders: true,
    legacyHeaders: false,
})

export const adminAuthRouter = Router();

// public routes
adminAuthRouter.post("/register",             (req, res, next) => ctrl().register(req, res, next));
adminAuthRouter.post("/login",                (req, res, next) => ctrl().login(req, res, next));
adminAuthRouter.post("/refresh",              (req, res, next) => ctrl().refresh(req, res, next));
adminAuthRouter.post("/verify-email",         (req, res, next) => ctrl().verifyEmail(req, res, next));
adminAuthRouter.post("/resend-verification",  loginLimiter, (req, res, next) => ctrl().resendVerification(req, res, next));
adminAuthRouter.post("/forgot-password",      loginLimiter, (req, res, next) => ctrl().forgotPassword(req, res, next));
adminAuthRouter.post("/reset-password",       loginLimiter, (req, res, next) => ctrl().resetPassword(req, res, next));

// Protected routes
adminAuthRouter.post("/logout",      authenticatedOrgMiddleware, (req, res, next) => ctrl().logout(req, res, next));
adminAuthRouter.post("/logout-all",  authenticatedOrgMiddleware, (req, res, next) => ctrl().logoutAll(req, res, next));
adminAuthRouter.get("/me",           authenticatedOrgMiddleware, (req, res, next) => ctrl().getMe(req, res, next));
adminAuthRouter.post("/switch-org",  authenticatedOrgMiddleware, (req, res, next) => ctrl().switchOrg(req, res, next));
adminAuthRouter.get("/socket-token", authenticatedOrgMiddleware, (req, res, next) => ctrl().getSocketToken(req, res, next));