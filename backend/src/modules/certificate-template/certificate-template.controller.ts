import { Request, Response, NextFunction } from "express";
import { CertificateTemplateService } from "./certificate-template.service";
import { createTemplateSchema, updateTemplateSchema, previewTemplateSchema, testGenerateSchema } from "./certificate-template.validator";

export class CertificateTemplateController {
    constructor(private readonly service: CertificateTemplateService) { }

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.service.listTemplates(req.user!.organizationId as string);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    };

    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.service.getTemplate(req.params.id as string, req.user!.organizationId as string);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = createTemplateSchema.parse(req.body);
            const result = await this.service.createTemplate(req.user!.organizationId as string, dto.name, dto.htmlContent, dto.description);
            res.status(201).json({ success: true, data: result.template, unknownPlaceholders: result.unknownPlaceholders });
        } catch (err) { next(err); }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = updateTemplateSchema.parse(req.body);
            const result = await this.service.updateTemplate(req.params.id as string, req.user!.organizationId as string, dto);
            res.status(200).json({ success: true, data: result.template, unknownPlaceholders: result.unknownPlaceholders });
        } catch (err) { next(err); }
    };

    remove = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.service.deleteTemplate(req.params.id as string, req.user!.organizationId as string);
            res.status(200).json({ success: true, message: "Certificate template deleted" });
        } catch (err) { next(err); }
    };

    preview = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = previewTemplateSchema.parse(req.body);
            const data = await this.service.previewTemplate(req.user!.organizationId as string, dto);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    };

    testGenerate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = testGenerateSchema.parse(req.body);
            const data = await this.service.testGenerate(req.user!.organizationId as string, req.params.id as string, dto);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    };
}
