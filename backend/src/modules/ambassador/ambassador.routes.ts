import { Router } from "express";
import { otpLimiter } from "../../middlewares/rate-limit";
import { authenticatedAmbassadorMiddleware } from "../../middlewares/authenticated-ambassador.middleware";

function ctrl() { return require("../../container").ambassadorController; }

// Public — unauthenticated, mounted at /api/v1/public/ambassador
export const ambassadorPublicRouter = Router();

ambassadorPublicRouter.get("/types",                 (req, res, next) => ctrl().getTypes(req, res, next));            // org-scoped: ?organizationId=
ambassadorPublicRouter.get("/platform-types",        (req, res, next) => ctrl().getPlatformTypes(req, res, next));    // platform-wide: signup flow
ambassadorPublicRouter.post("/upload-proof",         (req, res, next) => ctrl().getUploadUrl(req, res, next));

// Signup — 2-step, platform-level identity (no organizationId anywhere in this flow)
ambassadorPublicRouter.post("/signup/start",         otpLimiter, (req, res, next) => ctrl().signupStart(req, res, next));
ambassadorPublicRouter.post("/signup/verify-otp",    otpLimiter, (req, res, next) => ctrl().signupVerifyOtp(req, res, next));
ambassadorPublicRouter.post("/signup/complete",      (req, res, next) => ctrl().signupComplete(req, res, next));

// Login — returning ambassador
ambassadorPublicRouter.post("/auth/request-otp",     otpLimiter, (req, res, next) => ctrl().requestOtp(req, res, next));
ambassadorPublicRouter.post("/auth/verify-otp",      otpLimiter, (req, res, next) => ctrl().verifyOtp(req, res, next));

// Ambassador-authenticated, mounted at /api/v1/ambassador — cross-organization: an ambassador
// is one platform identity, browsing/applying to campaigns from any organization (mirrors how
// the public /contests listing isn't scoped to one org either).
export const ambassadorRouter = Router();

ambassadorRouter.use(authenticatedAmbassadorMiddleware);

ambassadorRouter.get("/me",                                     (req, res, next) => ctrl().getMe(req, res, next));
ambassadorRouter.patch("/me",                                   (req, res, next) => ctrl().updateMe(req, res, next));
ambassadorRouter.patch("/me/proof",                              (req, res, next) => ctrl().updateProof(req, res, next));
ambassadorRouter.patch("/me/profile-image",                      (req, res, next) => ctrl().updateProfileImage(req, res, next));
ambassadorRouter.post("/upload-proof",                          (req, res, next) => ctrl().getAuthenticatedUploadUrl(req, res, next));
ambassadorRouter.post("/upload-profile-image",                  (req, res, next) => ctrl().getProfileImageUploadUrl(req, res, next));
ambassadorRouter.post("/logout",                                (req, res, next) => ctrl().logout(req, res, next));
ambassadorRouter.get("/campaigns/available",                    (req, res, next) => ctrl().listAvailableCampaigns(req, res, next));
ambassadorRouter.get("/campaigns/mine",                         (req, res, next) => ctrl().listMyCampaigns(req, res, next));
ambassadorRouter.post("/campaigns/:campaignId/apply",            (req, res, next) => ctrl().applyToCampaign(req, res, next));
ambassadorRouter.get("/campaigns/:campaignId/stats",             (req, res, next) => ctrl().getCampaignStats(req, res, next));
ambassadorRouter.get("/campaigns/:campaignId/leaderboard",       (req, res, next) => ctrl().getCampaignLeaderboard(req, res, next));
ambassadorRouter.get("/campaigns/:campaignId/social-proof",      (req, res, next) => ctrl().getCampaignSocialProof(req, res, next));
ambassadorRouter.get("/activity",                                (req, res, next) => ctrl().getMyActivity(req, res, next));
