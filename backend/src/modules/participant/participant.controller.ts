import { Request, Response, NextFunction } from "express";
import { ParticipantService } from "./participant.service";
import { ListParticipantsQuerySchema, DisqualifyParticipantSchema } from "./participant.validator";
import { UnauthorizedError } from "../../error/http-errors";

export class ParticipantController {
    constructor(private readonly participantService: ParticipantService) { }

    listParticipants = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const query = ListParticipantsQuerySchema.parse(req.query);
            const contestId = req.params.contestId as string;

            const result = await this.participantService.getParticipants(
                user.organizationId,
                contestId,
                {
                    status: query.status as any,
                    page: query.page,
                    limit: query.limit,
                    search: req.query.search as string | undefined
                }
            );

            res.json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getParticipantDetails = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const participant = await this.participantService.getParticipantById(
                req.params.contestId as string,
                req.params.participantId as string,
                user.organizationId
            );

            res.json({ success: true, data: participant, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    disqualifyParticipant = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const { reason } = DisqualifyParticipantSchema.parse(req.body);

            await this.participantService.disqualifyParticipant(
                req.params.contestId as string,
                req.params.participantId as string,
                user.organizationId,
                reason
            );

            res.json({ success: true, message: "Participant disqualified", requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getStatusSummary = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const contestId = req.params.contestId as string;

            const result = await this.participantService.getStatusSummary(
                user.organizationId,
                contestId
            );

            res.json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    bulkStatusOverride = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const contestId = req.params.contestId as string;
            const { participantIds, status } = req.body;

            if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
                return res.status(400).json({ success: false, message: "Invalid or empty participantIds" });
            }
            if (!["REGISTERED", "DISQUALIFIED"].includes(status)) {
                return res.status(400).json({ success: false, message: "Invalid status to override. Allowed: REGISTERED, DISQUALIFIED" });
            }

            const result = await this.participantService.bulkStatusOverride(
                user.organizationId,
                contestId,
                participantIds,
                status
            );

            res.json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    triggerExport = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const contestId = req.params.contestId as string;
            const { format, filters } = req.body;

            if (!["csv", "pdf"].includes(format)) {
                return res.status(400).json({ success: false, message: "Invalid format. Must be csv or pdf" });
            }

            const exportLog = await this.participantService.triggerExport(
                user.organizationId,
                contestId,
                user.id,
                format,
                filters || {}
            );

            res.json({ success: true, data: exportLog, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getExportStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const { contestId, exportId } = req.params;

            const exportLog = await this.participantService.getExportStatus(
                user.organizationId,
                contestId as string,
                exportId as string
            );

            res.json({ success: true, data: exportLog, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };
}
