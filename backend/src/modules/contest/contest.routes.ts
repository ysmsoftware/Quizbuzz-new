import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

function ctrl()  { return require("../../container").contestController; }
function pctrl() { return require("../../container").participantController; }

export const contestRouter = Router();

contestRouter.post("/",              authenticatedOrgMiddleware, (req, res, next) => ctrl().createContest(req, res, next));
contestRouter.get("/",               authenticatedOrgMiddleware, (req, res, next) => ctrl().listContests(req, res, next));
contestRouter.post("/upload-banner", authenticatedOrgMiddleware, (req, res, next) => ctrl().uploadBanner(req, res, next));
contestRouter.post("/register/:contestSlug",                     (req, res, next) => ctrl().registerParticipant(req, res, next));

// Public Routes (no auth)
contestRouter.get("/public",       (req, res, next) => ctrl().listPublicContests(req, res, next));
contestRouter.get("/public/:slug", (req, res, next) => ctrl().getPublicContestBySlug(req, res, next));

contestRouter.get("/archived",             authenticatedOrgMiddleware, (req, res, next) => ctrl().listArchivedContests(req, res, next));
contestRouter.get("/:contestId",           authenticatedOrgMiddleware, (req, res, next) => ctrl().getContest(req, res, next));
contestRouter.patch("/:contestId",         authenticatedOrgMiddleware, (req, res, next) => ctrl().updateContest(req, res, next));
contestRouter.delete("/:contestId",        authenticatedOrgMiddleware, (req, res, next) => ctrl().deleteContest(req, res, next));
contestRouter.patch("/:contestId/archive", authenticatedOrgMiddleware, (req, res, next) => ctrl().archiveContest(req, res, next));

contestRouter.post("/:contestId/publish",            authenticatedOrgMiddleware, (req, res, next) => ctrl().publishContest(req, res, next));
contestRouter.post("/:contestId/close-registration", authenticatedOrgMiddleware, (req, res, next) => ctrl().closeRegistration(req, res, next));

// Participants (Admin)
contestRouter.get("/:contestId/participants",                             authenticatedOrgMiddleware, (req, res, next) => pctrl().listParticipants(req, res, next));
contestRouter.get("/:contestId/participants/status-summary",              authenticatedOrgMiddleware, (req, res, next) => pctrl().getStatusSummary(req, res, next));
contestRouter.get("/:contestId/participants/:participantId",               authenticatedOrgMiddleware, (req, res, next) => pctrl().getParticipantDetails(req, res, next));
contestRouter.patch("/:contestId/participants/:participantId/disqualify",  authenticatedOrgMiddleware, (req, res, next) => pctrl().disqualifyParticipant(req, res, next));

// Evaluation & Results
contestRouter.post("/:contestId/evaluate",        authenticatedOrgMiddleware, (req, res, next) => ctrl().triggerEvaluation(req, res, next));
contestRouter.get("/:contestId/results-info",     authenticatedOrgMiddleware, (req, res, next) => ctrl().getResultsDeclarationInfo(req, res, next));
contestRouter.post("/:contestId/declare-results", authenticatedOrgMiddleware, (req, res, next) => ctrl().declareResults(req, res, next));

// Leaderboard
contestRouter.get("/:contestId/leaderboard",       (req, res, next) => ctrl().getLeaderboard(req, res, next));
contestRouter.get("/:contestId/admin-leaderboard", authenticatedOrgMiddleware, (req, res, next) => ctrl().getAdminLeaderboard(req, res, next));
