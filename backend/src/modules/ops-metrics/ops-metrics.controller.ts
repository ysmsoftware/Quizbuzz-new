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
            const data = await this.service.getContestSnapshot(contestId);
            res.json({ success: true, data });
        } catch (err) { next(err); }
    };
}
