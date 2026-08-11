import { Router } from "express";
import { otpLimiter } from "../../middlewares/rate-limit";
import { authenticatedAmbassadorMiddleware } from "../../middlewares/authenticated-ambassador.middleware";

function ctrl() { return require("../../container").ambassadorController; }

// Public — unauthenticated, mounted at /api/v1/public/ambassador
export const ambassadorPublicRouter = Router();

ambassadorPublicRouter.get("/types",           (req, res, next) => ctrl().getTypes(req, res, next));
ambassadorPublicRouter.post("/upload-proof",   (req, res, next) => ctrl().getUploadUrl(req, res, next));
ambassadorPublicRouter.post("/apply",          (req, res, next) => ctrl().apply(req, res, next));
ambassadorPublicRouter.post("/auth/request-otp", otpLimiter, (req, res, next) => ctrl().requestOtp(req, res, next));
ambassadorPublicRouter.post("/auth/verify-otp",  otpLimiter, (req, res, next) => ctrl().verifyOtp(req, res, next));

// Ambassador-authenticated, mounted at /api/v1/ambassador
export const ambassadorRouter = Router();

ambassadorRouter.use(authenticatedAmbassadorMiddleware);

ambassadorRouter.get("/me",                                     (req, res, next) => ctrl().getMe(req, res, next));
ambassadorRouter.get("/campaigns/available",                    (req, res, next) => ctrl().listAvailableCampaigns(req, res, next));
ambassadorRouter.get("/campaigns/mine",                         (req, res, next) => ctrl().listMyCampaigns(req, res, next));
ambassadorRouter.post("/campaigns/:campaignId/join",             (req, res, next) => ctrl().joinCampaign(req, res, next));
ambassadorRouter.get("/campaigns/:campaignId/stats",             (req, res, next) => ctrl().getCampaignStats(req, res, next));
ambassadorRouter.get("/campaigns/:campaignId/leaderboard",       (req, res, next) => ctrl().getCampaignLeaderboard(req, res, next));
