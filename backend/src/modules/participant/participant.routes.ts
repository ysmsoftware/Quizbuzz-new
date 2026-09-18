import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

function ctrl() { return require("../../container").participantController; }

export const participantRouter = Router();

participantRouter.get("/:contestId/participants",                         authenticatedOrgMiddleware, (req, res, next) => ctrl().listParticipants(req, res, next));
participantRouter.get("/:contestId/participants/status-summary",          authenticatedOrgMiddleware, (req, res, next) => ctrl().getStatusSummary(req, res, next));
participantRouter.post("/:contestId/participants/bulk-status",            authenticatedOrgMiddleware, (req, res, next) => ctrl().bulkStatusOverride(req, res, next));
participantRouter.get("/:contestId/participants/:participantId",           authenticatedOrgMiddleware, (req, res, next) => ctrl().getParticipantDetails(req, res, next));
// Disqualify is handled by contestRouter (contest.routes.ts) -> ContestController,
// which orchestrates the full disqualify cascade (submission + leaderboard + email).
// A route registered here would never be reached anyway (contestRouter is mounted
// first on the same "/contests" base), so it's intentionally not duplicated.
participantRouter.post("/:contestId/participants/export",                 authenticatedOrgMiddleware, (req, res, next) => ctrl().triggerExport(req, res, next));
participantRouter.get("/:contestId/participants/export/:exportId",        authenticatedOrgMiddleware, (req, res, next) => ctrl().getExportStatus(req, res, next));
