import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service";
import { UnauthorizedError, ForbiddenError, BadRequestError } from "../../error/http-errors";
import {
    ContestsByStatusQuerySchema,
    OverviewQuerySchema,
    RecentRegistrationsQuerySchema,
    RegistrationTrendQuerySchema,
    UpcomingContestsQuerySchema,
} from "./dashboard.validator";

export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    // GET /org/:orgId/dashboard/overview?period=week|month
    getOverview = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = this._resolveOrgId(req);
            const query = OverviewQuerySchema.parse(req.query);

            const overview = await this.dashboardService.getOverview(organizationId, query);
            res.status(200).json({ success: true, data: overview, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // GET /org/:orgId/dashboard/upcoming-contests?limit=&status=&sortBy=&sortOrder=
    getUpcomingContests = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = this._resolveOrgId(req);
            const query = UpcomingContestsQuerySchema.parse(req.query);

            const contests = await this.dashboardService.getUpcomingContests(organizationId, query);
            res.status(200).json({ success: true, data: contests, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // GET /org/:orgId/dashboard/recent-registrations?limit=&page=&sortBy=&sortOrder=&contestId=&status=
    getRecentRegistrations = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = this._resolveOrgId(req);
            const query = RecentRegistrationsQuerySchema.parse(req.query);

            const registrations = await this.dashboardService.getRecentRegistrations(organizationId, query);
            res.status(200).json({ success: true, data: registrations, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // GET /org/:orgId/dashboard/registration-trend?days=
    getRegistrationTrend = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = this._resolveOrgId(req);
            const query = RegistrationTrendQuerySchema.parse(req.query);

            const trend = await this.dashboardService.getRegistrationTrend(organizationId, query);
            res.status(200).json({ success: true, data: trend, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // GET /org/:orgId/dashboard/contests-by-status?includeArchived=
    getContestsByStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = this._resolveOrgId(req);
            const query = ContestsByStatusQuerySchema.parse(req.query);

            const breakdown = await this.dashboardService.getContestsByStatus(organizationId, query);
            res.status(200).json({ success: true, data: breakdown, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * The dashboard is mounted under /org/:orgId/dashboard/* for URL consistency with
     * the rest of the organization module, but every query is actually scoped by the
     * *token's* organizationId, not the client-supplied path param — a client can't
     * page through another org's dashboard just by changing the URL.
     */
    private _resolveOrgId(req: Request): string {
        if (!req.user) throw new UnauthorizedError("User not authorized.");

        const orgId = req.params.orgId;
        if (!orgId) throw new BadRequestError("Organization ID is required");

        if (orgId !== req.user.organizationId) {
            throw new ForbiddenError("You do not have access to this organization's dashboard");
        }

        return orgId;
    }
}
