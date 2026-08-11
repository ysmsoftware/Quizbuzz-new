import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";
import { requireAmbassadorProgramEnabled } from "../../middlewares/require-ambassador-program-enabled.middleware";

function ctrl() { return require("../../container").ambassadorCampaignController; }

export const ambassadorCampaignRouter = Router();

ambassadorCampaignRouter.use(authenticatedOrgMiddleware);
ambassadorCampaignRouter.use(requireAmbassadorProgramEnabled);

ambassadorCampaignRouter.get("/applications",                     (req, res, next) => ctrl().listApplications(req, res, next));
ambassadorCampaignRouter.get("/applications/:id",                 (req, res, next) => ctrl().getApplication(req, res, next));
ambassadorCampaignRouter.post("/applications/:id/approve",        (req, res, next) => ctrl().approveApplication(req, res, next));
ambassadorCampaignRouter.post("/applications/:id/reject",         (req, res, next) => ctrl().rejectApplication(req, res, next));

ambassadorCampaignRouter.get("/campaigns",                        (req, res, next) => ctrl().listCampaigns(req, res, next));
ambassadorCampaignRouter.post("/campaigns",                       (req, res, next) => ctrl().createCampaign(req, res, next));
ambassadorCampaignRouter.post("/campaigns/upload-poster",         (req, res, next) => ctrl().uploadPoster(req, res, next));
ambassadorCampaignRouter.get("/campaigns/:id",                    (req, res, next) => ctrl().getCampaign(req, res, next));
ambassadorCampaignRouter.patch("/campaigns/:id",                  (req, res, next) => ctrl().updateCampaign(req, res, next));
ambassadorCampaignRouter.post("/campaigns/:id/duplicate",         (req, res, next) => ctrl().duplicateCampaign(req, res, next));
ambassadorCampaignRouter.get("/campaigns/:id/report",             (req, res, next) => ctrl().getCampaignReport(req, res, next));
ambassadorCampaignRouter.get("/campaigns/:id/report/export",      (req, res, next) => ctrl().exportCampaignReport(req, res, next));
ambassadorCampaignRouter.get("/campaigns/:id/leaderboard",        (req, res, next) => ctrl().getCampaignLeaderboard(req, res, next));
