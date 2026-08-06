import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";
import { idempotency } from "../../middlewares/idempotency.middleware";

function ctrl() { return require("../../container").contestController; }
function pctrl() { return require("../../container").participantController; }

export const contestRouter = Router();

contestRouter.post("/", authenticatedOrgMiddleware, (req, res, next) => ctrl().createContest(req, res, next));
contestRouter.get("/", authenticatedOrgMiddleware, (req, res, next) => ctrl().listContests(req, res, next));
contestRouter.post("/upload-banner", authenticatedOrgMiddleware, (req, res, next) => ctrl().uploadBanner(req, res, next));
contestRouter.post("/register/:contestSlug", (req, res, next) => ctrl().registerParticipant(req, res, next));
contestRouter.post("/register-status/:contestSlug", (req, res, next) => ctrl().getRegisterStatus(req, res, next));

// Public Routes (no auth)
contestRouter.get("/public", (req, res, next) => ctrl().listPublicContests(req, res, next));
contestRouter.get("/public/:slug", (req, res, next) => ctrl().getPublicContestBySlug(req, res, next));

// CRUD
contestRouter.get("/archived", authenticatedOrgMiddleware, (req, res, next) => ctrl().listArchivedContests(req, res, next));
contestRouter.get("/:contestId", authenticatedOrgMiddleware, (req, res, next) => ctrl().getContest(req, res, next));
contestRouter.patch("/:contestId", authenticatedOrgMiddleware, (req, res, next) => ctrl().updateContest(req, res, next));
contestRouter.delete("/:contestId", authenticatedOrgMiddleware, (req, res, next) => ctrl().deleteContest(req, res, next));
contestRouter.patch("/:contestId/archive", authenticatedOrgMiddleware, (req, res, next) => ctrl().archiveContest(req, res, next));

// Publish
contestRouter.post("/:contestId/publish", authenticatedOrgMiddleware, (req, res, next) => ctrl().publishContest(req, res, next));
contestRouter.post("/:contestId/close-registration", authenticatedOrgMiddleware, (req, res, next) => ctrl().closeRegistration(req, res, next));

// Lifecycle operations. Idempotency-guarded: each one fans out notifications to every
// registrant, so a retry or double-click must not message people twice.
contestRouter.post("/:contestId/reschedule", authenticatedOrgMiddleware, idempotency, (req, res, next) => ctrl().rescheduleContest(req, res, next));
contestRouter.post("/:contestId/cancel", authenticatedOrgMiddleware, idempotency, (req, res, next) => ctrl().cancelContest(req, res, next));
contestRouter.post("/:contestId/force-end", authenticatedOrgMiddleware, idempotency, (req, res, next) => ctrl().forceEndContest(req, res, next));

// Participants (Admin)
contestRouter.get("/:contestId/participants", authenticatedOrgMiddleware, (req, res, next) => pctrl().listParticipants(req, res, next));
contestRouter.get("/:contestId/participants/status-summary", authenticatedOrgMiddleware, (req, res, next) => pctrl().getStatusSummary(req, res, next));
contestRouter.get("/:contestId/participants/:participantId", authenticatedOrgMiddleware, (req, res, next) => pctrl().getParticipantDetails(req, res, next));
contestRouter.patch("/:contestId/participants/:participantId/disqualify", authenticatedOrgMiddleware, (req, res, next) => pctrl().disqualifyParticipant(req, res, next));

// Evaluation & Results
contestRouter.post("/:contestId/evaluate", authenticatedOrgMiddleware, (req, res, next) => ctrl().triggerEvaluation(req, res, next));
contestRouter.get("/:contestId/results-info", authenticatedOrgMiddleware, (req, res, next) => ctrl().getResultsDeclarationInfo(req, res, next));
contestRouter.post("/:contestId/declare-results", authenticatedOrgMiddleware, (req, res, next) => ctrl().declareResults(req, res, next));

// Leaderboard
contestRouter.get("/:contestId/leaderboard", (req, res, next) => ctrl().getLeaderboard(req, res, next));
contestRouter.get("/:contestId/admin-leaderboard", authenticatedOrgMiddleware, (req, res, next) => ctrl().getAdminLeaderboard(req, res, next));
