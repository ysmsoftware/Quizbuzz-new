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
ambassadorCampaignRouter.post("/campaigns/poster-upload-url",     (req, res, next) => ctrl().getPosterUploadUrl(req, res, next));
ambassadorCampaignRouter.get("/campaigns/:id",                    (req, res, next) => ctrl().getCampaign(req, res, next));
ambassadorCampaignRouter.patch("/campaigns/:id",                  (req, res, next) => ctrl().updateCampaign(req, res, next));
ambassadorCampaignRouter.post("/campaigns/:id/publish",           (req, res, next) => ctrl().publishCampaign(req, res, next));
ambassadorCampaignRouter.post("/campaigns/:id/activate",          (req, res, next) => ctrl().activateCampaign(req, res, next));
ambassadorCampaignRouter.post("/campaigns/:id/end",                (req, res, next) => ctrl().endCampaign(req, res, next));
ambassadorCampaignRouter.post("/campaigns/:id/archive",           (req, res, next) => ctrl().archiveCampaign(req, res, next));
ambassadorCampaignRouter.get("/campaigns/:id/groups",              (req, res, next) => ctrl().getGroups(req, res, next));
ambassadorCampaignRouter.put("/campaigns/:id/groups",              (req, res, next) => ctrl().replaceGroups(req, res, next));
ambassadorCampaignRouter.post("/campaigns/:id/duplicate",         (req, res, next) => ctrl().duplicateCampaign(req, res, next));
ambassadorCampaignRouter.get("/campaigns/:id/report",             (req, res, next) => ctrl().getCampaignReport(req, res, next));
ambassadorCampaignRouter.get("/campaigns/:id/report/export",      (req, res, next) => ctrl().exportCampaignReport(req, res, next));
ambassadorCampaignRouter.get("/campaigns/:id/leaderboard",        (req, res, next) => ctrl().getCampaignLeaderboard(req, res, next));

ambassadorCampaignRouter.get("/campaign-templates",                (req, res, next) => ctrl().listTemplates(req, res, next));
ambassadorCampaignRouter.post("/campaign-templates",               (req, res, next) => ctrl().createTemplate(req, res, next));
ambassadorCampaignRouter.delete("/campaign-templates/:id",         (req, res, next) => ctrl().deleteTemplate(req, res, next));
ambassadorCampaignRouter.post("/campaign-templates/:id/instantiate", (req, res, next) => ctrl().instantiateTemplate(req, res, next));
