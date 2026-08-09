import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";


function ctrl() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../../container").dashboardController;
}

export const dashboardRouter = Router();

dashboardRouter.get("/:orgId/dashboard/overview", authenticatedOrgMiddleware, (req, res, next) => ctrl().getOverview(req, res, next));
dashboardRouter.get("/:orgId/dashboard/upcoming-contests", authenticatedOrgMiddleware, (req, res, next) => ctrl().getUpcomingContests(req, res, next));
dashboardRouter.get("/:orgId/dashboard/recent-registrations", authenticatedOrgMiddleware, (req, res, next) => ctrl().getRecentRegistrations(req, res, next));
dashboardRouter.get("/:orgId/dashboard/registration-trend", authenticatedOrgMiddleware, (req, res, next) => ctrl().getRegistrationTrend(req, res, next));
dashboardRouter.get("/:orgId/dashboard/contests-by-status", authenticatedOrgMiddleware, (req, res, next) => ctrl().getContestsByStatus(req, res, next));
