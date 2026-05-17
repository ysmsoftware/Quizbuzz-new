import { NextFunction, Request, Response } from "express";
import { ContactService } from "./contact.service";
import {
    CreateContactSchema,
    ListContactsQuerySchema,
    UpdateContactSchema,
} from "./contact.validator";

export class ContactController {

    constructor(private readonly service: ContactService) { }


    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = CreateContactSchema.parse(req.body);
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                res.status(400).json({ success: false, message: "Organization ID is required" });
                return;
            }

            const result = await this.service.create(organizationId, data);

            res.status(201).json({
                success: true,
                message: "Contact created",
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    lookup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user?.organizationId;
            const email = req.query.email as string;
            const phone = req.query.phone as string;

            if (!organizationId) {
                res.status(400).json({ success: false, message: "Organization ID is required" });
                return;
            }

            const result = await this.service.lookup(organizationId, { email, phone });

            res.status(200).json({
                success: true,
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const query = ListContactsQuerySchema.parse(req.query);
            const organizationId = req.user!.organizationId;
            const result = await this.service.list(organizationId, query);

            res.status(200).json({
                success: true,
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const result = await this.service.getById(req.params.id as string, organizationId);

            res.status(200).json({
                success: true,
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = UpdateContactSchema.parse(req.body);
            const organizationId = req.user!.organizationId;
            const result = await this.service.update(
                req.params.id as string,
                organizationId,
                data
            );

            res.status(200).json({
                success: true,
                message: "Contact updated",
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    softDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            await this.service.softDelete(req.params.id as string, organizationId);

            res.status(200).json({
                success: true,
                message: "Contact deleted",
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    getContests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const result = await this.service.getContests(req.params.id as string, organizationId);

            res.status(200).json({
                success: true,
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;

            const result = await this.service.getMessages(
                req.params.id as string,
                organizationId,
                page,
                limit
            );

            res.status(200).json({
                success: true,
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    getCertificates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;

            const result = await this.service.getCertificates(
                req.params.id as string,
                organizationId,
                page,
                limit
            );

            res.status(200).json({
                success: true,
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };
}