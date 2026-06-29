import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

function ctrl() { return require("../../container").proctoringController; }

export const proctoringRouter = Router();

proctoringRouter.use(authenticatedOrgMiddleware);

proctoringRouter.get("/contests/:contestId/overview",                                          (req, res, next) => ctrl().getContestOverview(req, res, next));
proctoringRouter.get("/contests/:contestId/flagged",                                           (req, res, next) => ctrl().getFlaggedParticipants(req, res, next));
proctoringRouter.get("/contests/:contestId/participants/:participantId/events",                 (req, res, next) => ctrl().getParticipantEvents(req, res, next));
proctoringRouter.patch("/scores/:scoreId/status",                                              (req, res, next) => ctrl().updateViolationStatus(req, res, next));
proctoringRouter.get("/contests/:contestId/participants/:participantId/captures",               (req, res, next) => ctrl().getParticipantCaptures(req, res, next));
