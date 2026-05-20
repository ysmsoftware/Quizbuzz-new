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

    getTemplates = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) throw new UnauthorizedError("User not authorized.");

            const templates = [
                {
                    id: "REGISTRATION_SUCCESSFUL",
                    orgId: user.organizationId,
                    name: "Registration Successful / Confirmation",
                    channel: "both",
                    body: "Dear {{name}}, thank you for registering for {{eventName}} at YSM Info Solution.\nDate: {{date}}\nTime: {{time}}\nLocation/Link: {{link}}\nWe look forward to your participation.",
                    variables: ["name", "eventName", "date", "time", "link"],
                    isSystem: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: "WORKSHOP_REMINDER_MESSAGE",
                    orgId: user.organizationId,
                    name: "Workshop / Contest Reminder",
                    channel: "both",
                    body: "Dear {{name}}, this is a reminder for your registered program: {{eventName}}\nDate: {{date}}\nTime: {{time}}\nVenue/Link: {{link}}\nKindly be available 10 minutes before the scheduled time.",
                    variables: ["name", "eventName", "date", "time", "link"],
                    isSystem: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: "PAYMENT_CONFIRMATION_MESSAGE",
                    orgId: user.organizationId,
                    name: "Payment Confirmation",
                    channel: "both",
                    body: "Dear {{name}}, we have successfully received your payment of Rs. {{amount}} for {{eventName}}. Thank you!",
                    variables: ["name", "amount", "eventName"],
                    isSystem: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: "CERTIFICATE_ISSUED",
                    orgId: user.organizationId,
                    name: "Certificate Issued",
                    channel: "both",
                    body: "Hello {{name}}, your certificate for {{eventName}} has been issued.\nDownload link: {{link}}\nKeep learning & growing!",
                    variables: ["name", "eventName", "link"],
                    isSystem: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: "DISQUALIFICATION_NOTICE",
                    orgId: user.organizationId,
                    name: "Disqualification Notice",
                    channel: "both",
                    body: "Dear {{name}}, we regret to inform you that you have been disqualified from {{eventName}} due to: {{reason}}",
                    variables: ["name", "eventName", "reason"],
                    isSystem: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: "RESULTS_PUBLISHED",
                    orgId: user.organizationId,
                    name: "Results Published",
                    channel: "both",
                    body: "Hello {{name}}, the results for {{eventName}} have been published!\nView leaderboard & results: {{link}}\nThank you for participating.",
                    variables: ["name", "eventName", "link"],
                    isSystem: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: "FEEDBACK_COLLECTION_MESSAGE",
                    orgId: user.organizationId,
                    name: "Feedback Collection",
                    channel: "both",
                    body: "Dear {{name}}, thank you for being part of {{eventName}}. Please share your feedback: https://g.page/r/CbW3sg1807sqEBM/review",
                    variables: ["name", "eventName"],
                    isSystem: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: "OTP_VERIFICATION_CODE",
                    orgId: user.organizationId,
                    name: "OTP Verification Code",
                    channel: "both",
                    body: "Your One-Time Password (OTP) for YSM Info Solution is: {{otp}}",
                    variables: ["otp", "name"],
                    isSystem: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: "BIRTHDAY_WISHES_YSM",
                    orgId: user.organizationId,
                    name: "Birthday Wishes YSM",
                    channel: "both",
                    body: "Hello {{name}}, Team YSM Info Solution wishes you a very Happy Birthday! 🎉 May this year bring you success, growth and new opportunities.",
                    variables: ["name"],
                    isSystem: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: "CUSTOM",
                    orgId: user.organizationId,
                    name: "Custom Broadcast Message",
                    channel: "both",
                    body: "Hello {{name}},\n\n{{body}}\n\nRegards,\nTeam QuizBuzz",
                    variables: ["name", "subject", "body"],
                    isSystem: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ];

            res.json({ success: true, data: templates, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };
}
