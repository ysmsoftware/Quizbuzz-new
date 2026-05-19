import { Request, Response, NextFunction } from "express";
import { QuestionService } from "./question.service";
import {
    CreateQuestionSchema,
    UpdateQuestionSchema,
    BulkCreateQuestionsSchema,
    ListQuestionsQuerySchema,
    AssignQuestionsWithPositionCheckSchema,
    ReorderQuestionsSchema,
    UpdateContestQuestionSchema,
    AutoGenerateQuestionsSchema,
} from "./question.validator";
import { UnauthorizedError } from "../../error/http-errors";

export class QuestionController {
    constructor(private readonly questionService: QuestionService) { }

    // ─── Question Bank ────────────────────────────────────────────────────────

    createQuestion = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if(!user) {
                throw new UnauthorizedError("User not authorized");
            }
            const dto = CreateQuestionSchema.parse(req.body);

            const question = await this.questionService.createQuestion(
                user.organizationId,
                dto
            );

            res.status(201).json({
                success: true,
                message: "Question created",
                data: {
                    id: question.id,
                    questionText: question.questionText,
                    difficulty: question.difficulty,
                },
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    bulkCreateQuestions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if(!user) {
                throw new UnauthorizedError("User not authorized");
            }
            const dto = BulkCreateQuestionsSchema.parse(req.body);

            const result = await this.questionService.bulkCreateQuestions(
                user.organizationId,
                dto
            );

            res.status(201).json({
                success: true,
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    listQuestions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if(!user) {
                throw new UnauthorizedError("User not authorized");
            }
            const query = ListQuestionsQuerySchema.parse(req.query);

            const result = await this.questionService.listQuestions(
                user.organizationId,
                query
            );

            res.json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getQuestion = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if(!user) {
                throw new UnauthorizedError("User not authorized");
            }
            const question = await this.questionService.getQuestion(
                req.params.questionId as string,
                user.organizationId
            );

            res.json({ success: true, data: question, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if(!user) {
                throw new UnauthorizedError("User not authorized");
            }
            const dto = UpdateQuestionSchema.parse(req.body);

            const question = await this.questionService.updateQuestion(
                req.params.questionId as string,
                user.organizationId,
                dto
            );

            res.json({
                success: true,
                message: "Question updated",
                data: question,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if(!user) {
                throw new UnauthorizedError("User not authorized");
            }

            await this.questionService.deleteQuestion(
                req.params.questionId as string,
                user.organizationId
            );

            res.json({
                success: true,
                message: "Question deleted",
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    getDistinctTags = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if(!user) {
                throw new UnauthorizedError("User not authorized");
            }

            const tags = await this.questionService.getDistinctTags(user.organizationId);

            res.json({
                success: true,
                data: { tags },
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    // ─── Contest–Question Assignment ──────────────────────────────────────────

    assignQuestionsToContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if(!user) {
                throw new UnauthorizedError("User not authorized");
            }
            const dto = AssignQuestionsWithPositionCheckSchema.parse(req.body);

            const result = await this.questionService.assignQuestionsToContest(
                req.params.contestId as string,
                user.organizationId,
                dto
            );

            res.status(201).json({
                success: true,
                message: `${result.assigned} question(s) assigned${result.skipped > 0 ? `, ${result.skipped} already assigned (skipped)` : ""}`,
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    removeQuestionFromContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized");
            }
            await this.questionService.removeQuestionFromContest(
                req.params.contestId as string,
                req.params.questionId as string,
                user.organizationId as string
            );

            res.json({
                success: true,
                message: "Question removed from contest",
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

   
    updateContestQuestion = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if(!user) {
                throw new UnauthorizedError("User not authorized");
            }
            const dto = UpdateContestQuestionSchema.parse(req.body);

            const result = await this.questionService.updateContestQuestion(
                req.params.contestId as string,
                req.params.questionId as string,
                user.organizationId,
                dto
            );

            res.json({
                success: true,
                message: "Contest question config updated",
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    getContestQuestions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if(!user) {
                throw new UnauthorizedError("User not authorized");
            }

            const questions = await this.questionService.getContestQuestions(
                req.params.contestId as string,
                user.organizationId
            );

            res.json({ success: true, data: questions, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    autoGenerateQuestions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized");
            }
            const dto = AutoGenerateQuestionsSchema.parse(req.body);

            const result = await this.questionService.autoGenerateQuestions(
                req.params.contestId as string,
                user.organizationId,
                dto
            );

            res.status(201).json({
                success: true,
                message: `Successfully auto-generated and assigned ${result.assignedCount} question(s) to the contest.`,
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };
}