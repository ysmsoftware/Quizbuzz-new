import { Router } from "express";
import { analyticsController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

export const analyticsRouter = Router();

// GET /analytics/:id
analyticsRouter.get("/:id", authenticatedOrgMiddleware, (req, res) => analyticsController.getContestAnalytics(req, res));

// GET /analytics/:id/live
analyticsRouter.get("/:id/live", authenticatedOrgMiddleware, (req, res) => analyticsController.getLiveAnalytics(req, res));

// POST /analytics/:id/refresh
analyticsRouter.post("/:id/refresh", authenticatedOrgMiddleware, (req, res) => analyticsController.refreshAnalytics(req, res));

// GET /analytics/:id/score-distribution
analyticsRouter.get("/:id/score-distribution", authenticatedOrgMiddleware, (req, res) => analyticsController.getScoreDistribution(req, res));
