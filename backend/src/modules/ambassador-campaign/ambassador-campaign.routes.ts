import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";
import { requireAmbassadorProgramEnabled } from "../../middlewares/require-ambassador-program-enabled.middleware";

function ctrl() { return require("../../container").ambassadorCampaignController; }

// ─── /org/ambassadors — applications review + the org-wide ambassador directory ─────────
// "Ambassadors" is people: reviewing who applied, and listing who's actually part of the
// program (approved, deduped across campaigns). Campaign management itself lives at
// /org/campaigns (below) — kept separate so the URL says what's actually being addressed,
// instead of campaign CRUD being nested under a router named for a different resource.
export const orgAmbassadorRouter = Router();

orgAmbassadorRouter.use(authenticatedOrgMiddleware);
orgAmbassadorRouter.use(requireAmbassadorProgramEnabled);

orgAmbassadorRouter.get("/applications",              (req, res, next) => ctrl().listApplications(req, res, next));
orgAmbassadorRouter.get("/applications/:id",          (req, res, next) => ctrl().getApplication(req, res, next));
orgAmbassadorRouter.post("/applications/:id/approve", (req, res, next) => ctrl().approveApplication(req, res, next));
orgAmbassadorRouter.post("/applications/:id/reject",  (req, res, next) => ctrl().rejectApplication(req, res, next));

// Directory routes registered after /applications so that literal path always wins over
// the :ambassadorId param match below it.
orgAmbassadorRouter.get("/",              (req, res, next) => ctrl().listOrgAmbassadors(req, res, next));
orgAmbassadorRouter.get("/:ambassadorId", (req, res, next) => ctrl().getOrgAmbassador(req, res, next));

// ─── /org/campaigns — campaign CRUD, groups, templates, reporting ───────────────────────
export const campaignRouter = Router();

campaignRouter.use(authenticatedOrgMiddleware);
campaignRouter.use(requireAmbassadorProgramEnabled);

campaignRouter.get("/",                   (req, res, next) => ctrl().listCampaigns(req, res, next));
campaignRouter.post("/",                  (req, res, next) => ctrl().createCampaign(req, res, next));
campaignRouter.post("/poster-upload-url", (req, res, next) => ctrl().getPosterUploadUrl(req, res, next));

// Templates registered before /:id so "templates" is never swallowed as a campaign id.
campaignRouter.get("/templates",                  (req, res, next) => ctrl().listTemplates(req, res, next));
campaignRouter.post("/templates",                 (req, res, next) => ctrl().createTemplate(req, res, next));
campaignRouter.delete("/templates/:id",           (req, res, next) => ctrl().deleteTemplate(req, res, next));
campaignRouter.post("/templates/:id/instantiate", (req, res, next) => ctrl().instantiateTemplate(req, res, next));

campaignRouter.get("/:id",               (req, res, next) => ctrl().getCampaign(req, res, next));
campaignRouter.patch("/:id",             (req, res, next) => ctrl().updateCampaign(req, res, next));
campaignRouter.post("/:id/publish",      (req, res, next) => ctrl().publishCampaign(req, res, next));
campaignRouter.post("/:id/activate",     (req, res, next) => ctrl().activateCampaign(req, res, next));
campaignRouter.post("/:id/end",          (req, res, next) => ctrl().endCampaign(req, res, next));
campaignRouter.post("/:id/archive",      (req, res, next) => ctrl().archiveCampaign(req, res, next));
campaignRouter.get("/:id/groups",        (req, res, next) => ctrl().getGroups(req, res, next));
campaignRouter.put("/:id/groups",        (req, res, next) => ctrl().replaceGroups(req, res, next));
campaignRouter.post("/:id/duplicate",    (req, res, next) => ctrl().duplicateCampaign(req, res, next));
campaignRouter.get("/:id/stats",         (req, res, next) => ctrl().getCampaignStatsSummary(req, res, next));
campaignRouter.get("/:id/report",        (req, res, next) => ctrl().getCampaignReport(req, res, next));
campaignRouter.get("/:id/report/export", (req, res, next) => ctrl().exportCampaignReport(req, res, next));
campaignRouter.get("/:id/leaderboard",   (req, res, next) => ctrl().getCampaignLeaderboard(req, res, next));
