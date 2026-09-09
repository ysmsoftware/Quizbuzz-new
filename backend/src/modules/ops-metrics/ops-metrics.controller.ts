import { Request, Response, NextFunction } from "express";
import { OpsMetricsService } from "./ops-metrics.service";
import { BadRequestError } from "../../error/http-errors";

export class OpsMetricsController {
    constructor(private readonly service: OpsMetricsService) { }

    getFleet = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.service.getFleetSnapshot();
            res.json({ success: true, data });
        } catch (err) { next(err); }
    };

    listContests = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.service.listLiveContests();
            res.json({ success: true, data });
        } catch (err) { next(err); }
    };

    getContestSnapshot = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const contestId = req.params.contestId as string;
            if (!contestId) throw new BadRequestError("contestId is required");
            const offset = req.query.offset ? Number(req.query.offset) : undefined;
            const limit = req.query.limit ? Number(req.query.limit) : undefined;
            const data = await this.service.getContestSnapshot(contestId, { offset, limit });
            res.json({ success: true, data });
        } catch (err) { next(err); }
    };
}
