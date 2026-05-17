import { Request, Response, NextFunction } from "express";
import { ContestService } from "./contest.service";
import {
    CreateContestSchema,
    UpdateContestSchema,
    ListContestsQuerySchema,
    RegisterParticipantSchema,
    AssignQuestionsSchema,
    ReorderQuestionsSchema,
    GenerateCertificatesSchema,
    CancelContestSchema,
} from "./contest.validator";
import { UnauthorizedError } from "../../error/http-errors";

export class ContestController {
    constructor(private readonly contestService: ContestService) { }

    // ─── Contest CRUD ─────────────────────────────────────────────────────────

    createContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const data = CreateContestSchema.parse(req.body);

            const contest = await this.contestService.createContest(
                user.organizationId,
                user.id,
                data
            );

            res.status(201).json({
                success: true,
                message: "Contest created",
                data: {
                    id: contest.id,
                    slug: contest.slug,
                    status: contest.status,
                    joinCode: contest.joinCode,
                },
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    listContests = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            const query = ListContestsQuerySchema.parse(req.query);

            const contests = await this.contestService.listContests(user.organizationId, query);

            res.status(200).json({ success: true, data: contests, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            const contest = await this.contestService.getContest(
                req.params.contestId as string,
                user.organizationId
            );

            res.status(200).json({ success: true, data: contest, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    updateContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            const data = UpdateContestSchema.parse(req.body);

            const contest = await this.contestService.updateContest(
                req.params.contestId as string,
                user.organizationId,
                data
            );

            res.status(200).json({ success: true, data: contest, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    publishContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            const result = await this.contestService.publishContest(
                req.params.contestId as string,
                user.organizationId
            );

            res.json({ success: true, message: "Contest published", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    deleteContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            };
            await this.contestService.deleteContest(req.params.contestId as string, user.organizationId);

            res.json({ success: true, message: "Contest deleted", requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // ─── Registration (Public) ────────────────────────────────────────────────

    registerParticipant = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = RegisterParticipantSchema.parse(req.body);
            const result = await this.contestService.registerParticipant(
                req.params.contestSlug as string,
                dto
            );

            res.status(201).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // ─── Evaluation & Results ─────────────────────────────────────────────────

    triggerEvaluation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const result = await this.contestService.triggerEvaluation(
                req.params.contestId as string,
                user.organizationId
            );

            res.json({ success: true, message: "Evaluation triggered", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    declareResults = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const result = await this.contestService.declareResults(
                req.params.contestId as string,
                user.organizationId
            );

            res.json({ success: true, message: "Results declared", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const contestId = req.params.contestId as string;
            const organizationId = req.user?.organizationId ?? "";
            
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;

            const result = await this.contestService.getLeaderboard(
                contestId,
                organizationId,
                page,
                limit
            );

            res.status(200).json({ success: true, ...result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };
}