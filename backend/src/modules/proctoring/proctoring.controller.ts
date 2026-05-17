import { Request, Response, NextFunction } from "express";
import { ProctoringService } from "./proctoring.service";
import {
    ProctoringPaginationSchema,
    UpdateViolationStatusSchema
} from "./proctoring.validator";

export class ProctoringController {
    constructor(private proctoringService: ProctoringService) { }

    getContestOverview = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { contestId } = req.params;
            const overview = await this.proctoringService.getContestOverview(contestId as string);
            res.json({ success: true, data: overview });
        } catch (error) {
            next(error);
        }
    };

    getFlaggedParticipants = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { contestId } = req.params;
            const query = ProctoringPaginationSchema.parse(req.query);
            const result = await this.proctoringService.getFlaggedParticipants(contestId as string, query);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    };

    getParticipantEvents = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { contestId, participantId } = req.params;
            const events = await this.proctoringService.getParticipantEvents(contestId as string, participantId as string);
            res.json({ success: true, data: { events } });
        } catch (error) {
            next(error);
        }
    };

    updateViolationStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { scoreId } = req.params;
            const organizationId = req.user!.organizationId;
            const body = UpdateViolationStatusSchema.parse(req.body);

            const updated = await this.proctoringService.updateViolationStatus(
                scoreId as string,
                organizationId,
                body.isDismissed,
            );

            res.json({ success: true, data: updated });
        } catch (error) {
            next(error);
        }
    };
}
