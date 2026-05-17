import { Request, Response, NextFunction } from "express";
import { MessagingService } from "./messaging.service";
import { SendMessageSchema, PaginationQuerySchema } from "./messaging.validator";
import { UnauthorizedError } from "../../error/http-errors";

export class MessagingController {
    constructor(private readonly messagingService: MessagingService) { }

    getMessageById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) throw new UnauthorizedError("User not authorized.");

            const message = await this.messagingService.getMessageById(
                req.params.id as string,
                user.organizationId
            );

            res.json({ success: true, data: message, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getMessagesByContact = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) throw new UnauthorizedError("User not authorized.");

            const { page, limit } = PaginationQuerySchema.parse(req.query);

            const result = await this.messagingService.getMessagesByContact(
                req.params.contactId as string,
                user.organizationId,
                page,
                limit
            );

            res.json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getMessagesByContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) throw new UnauthorizedError("User not authorized.");

            const { page, limit } = PaginationQuerySchema.parse(req.query);

            const result = await this.messagingService.getMessagesByContest(
                req.params.contestId as string,
                user.organizationId,
                page,
                limit
            );

            res.json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getMessagesByContactInContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) throw new UnauthorizedError("User not authorized.");

            const { page, limit } = PaginationQuerySchema.parse(req.query);

            const result = await this.messagingService.getMessagesByContactInContest(
                req.params.contactId as string,
                req.params.contestId as string,
                user.organizationId,
                page,
                limit
            );

            res.json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    sendMessage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) throw new UnauthorizedError("User not authorized.");

            const dto = SendMessageSchema.parse(req.body);

            const message = await this.messagingService.sendMessage(dto, user.organizationId);

            res.status(201).json({
                success: true,
                message: "Message queued for sending",
                data: message,
                requestId: req.id
            });
        } catch (err) {
            next(err);
        }
    };

    retryMessage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) throw new UnauthorizedError("User not authorized.");

            const message = await this.messagingService.retryMessage(
                req.params.id as string,
                user.organizationId
            );

            res.json({
                success: true,
                message: "Message queued for retry",
                data: message,
                requestId: req.id
            });
        } catch (err) {
            next(err);
        }
    };

    retryFailedMessages = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) throw new UnauthorizedError("User not authorized.");

            const result = await this.messagingService.retryFailedMessages(user.organizationId);

            res.json({
                success: true,
                message: `Queued ${result.count} failed messages for retry`,
                data: result,
                requestId: req.id
            });
        } catch (err) {
            next(err);
        }
    };
}
