import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

function ctrl() { return require("../../container").analyticsController; }

export const analyticsRouter = Router();

analyticsRouter.get("/:id",         authenticatedOrgMiddleware, (req, res, next) => ctrl().getContestAnalytics(req, res, next));
analyticsRouter.get("/:id/live",    authenticatedOrgMiddleware, (req, res, next) => ctrl().getLiveAnalytics(req, res, next));
analyticsRouter.post("/:id/refresh",authenticatedOrgMiddleware, (req, res, next) => ctrl().refreshAnalytics(req, res, next));
analyticsRouter.get("/:id/score-distribution", authenticatedOrgMiddleware, (req, res, next) => ctrl().getScoreDistribution(req, res, next));
