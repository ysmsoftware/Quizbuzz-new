import { Request, Response } from "express";
import { AnalyticsService } from "./analytics.service";
import logger from "../../config/logger";

export class AnalyticsController {
    constructor(private analyticsService: AnalyticsService) { }

    async getContestAnalytics(req: Request, res: Response) {
        try {
            const { id: contestId } = req.params;
            const organizationId = req.user?.organizationId;

            if (!contestId || typeof contestId !== "string") {
                return res.status(400).json({ message: "Invalid contest ID" });
            }

            if (!organizationId || typeof organizationId !== "string") {
                return res.status(403).json({ message: "Organization context missing" });
            }

            const analytics = await this.analyticsService.getContestAnalytics(contestId, organizationId);
            return res.json({ success: true, data: analytics });
        } catch (error) {
            logger.error(`[analytics-controller] Failed to fetch analytics:`, error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async getLiveAnalytics(req: Request, res: Response) {
        try {
            const { id: contestId } = req.params;
            const organizationId = req.user?.organizationId;

            if (!contestId || typeof contestId !== "string" || !organizationId || typeof organizationId !== "string") {
                return res.status(400).json({ message: "Missing contest or org ID" });
            }

            const analytics = await this.analyticsService.getContestAnalytics(contestId, organizationId);

            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
            res.setHeader("Pragma", "no-cache");

            return res.json({ success: true, data: analytics.live });
        } catch (error) {
            logger.error(`[analytics-controller] Failed to fetch live analytics:`, error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async refreshAnalytics(req: Request, res: Response) {
        try {
            const { id: contestId } = req.params;
            const organizationId = req.user?.organizationId;

            if (!contestId || typeof contestId !== "string" || !organizationId || typeof organizationId !== "string") {
                return res.status(400).json({ message: "Missing contest or org ID" });
            }

            const snapshot = await this.analyticsService.generateSnapshot(contestId, organizationId);
            return res.json({ success: true, data: snapshot, message: "Analytics refreshed" });
        } catch (error) {
            logger.error(`[analytics-controller] Failed to refresh analytics:`, error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async getScoreDistribution(req: Request, res: Response) {
        try {
            const { id: contestId } = req.params;

            if (!contestId || typeof contestId !== "string") {
                return res.status(400).json({ message: "Invalid contest ID" });
            }

            const distribution = await this.analyticsService.getScoreDistribution(contestId);
            return res.json({ success: true, data: distribution });
        } catch (error) {
            logger.error(`[analytics-controller] Failed to fetch score distribution:`, error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
}
