import { Request, Response, NextFunction } from "express";
import { AmbassadorCampaignService } from "./ambassador-campaign.service";
import { UnauthorizedError } from "../../error/http-errors";
import {
    CreateCampaignSchema,
    UpdateCampaignSchema,
    DuplicateCampaignSchema,
    ListCampaignsQuerySchema,
    ListApplicationsQuerySchema,
    RejectApplicationSchema,
    ListReportQuerySchema,
    LeaderboardQuerySchema,
    ReplaceGroupsSchema,
    CreateTemplateSchema,
    InstantiateTemplateSchema,
    ListTemplatesQuerySchema,
    RequestPosterUploadUrlSchema,
} from "./ambassador-campaign.validator";

export class AmbassadorCampaignController {

    constructor(private readonly service: AmbassadorCampaignService) { }

    /**
     * POST /org/ambassadors/campaigns/poster-upload-url
     * Presigned-PUT-URL flow — same shape as the ambassador-proof upload
     * (AmbassadorController.getUploadUrl): the frontend PUTs the file straight to S3 with
     * the returned URL, then strips the query string off it to get the permanent object URL.
     * No file body ever passes through this backend.
     */
    getPosterUploadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const dto = RequestPosterUploadUrlSchema.parse(req.body);
            const result = await this.service.getPosterUploadUrl(user.organizationId, dto.filename, dto.mimeType);

            res.status(200).json({
                success: true,
                message: "Upload URL generated successfully",
                data: result,
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    // ─── Applications ────────────────────────────────────────────────────────────

    listApplications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const query = ListApplicationsQuerySchema.parse(req.query);
            const result = await this.service.listApplications(organizationId, query);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getApplication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const result = await this.service.getApplication(organizationId, req.params.id as string);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    approveApplication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id: reviewedById, organizationId } = req.user!;
            const result = await this.service.approveApplication(organizationId, req.params.id as string, reviewedById);
            res.status(200).json({ success: true, message: "Application approved", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    rejectApplication = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id: reviewedById, organizationId } = req.user!;
            const { reason } = RejectApplicationSchema.parse(req.body);
            const result = await this.service.rejectApplication(organizationId, req.params.id as string, reviewedById, reason);
            res.status(200).json({ success: true, message: "Application rejected", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // ─── Campaigns ───────────────────────────────────────────────────────────────

    createCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id: createdById, organizationId } = req.user!;
            const data = CreateCampaignSchema.parse(req.body);
            const result = await this.service.createCampaign(organizationId, createdById, data);
            res.status(201).json({ success: true, message: "Campaign created", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    listCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const query = ListCampaignsQuerySchema.parse(req.query);
            const result = await this.service.listCampaigns(organizationId, query);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const result = await this.service.getCampaign(organizationId, req.params.id as string);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    updateCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const data = UpdateCampaignSchema.parse(req.body);
            const result = await this.service.updateCampaign(organizationId, req.params.id as string, data);
            res.status(200).json({ success: true, message: "Campaign updated", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    publishCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const result = await this.service.publishCampaign(organizationId, req.params.id as string);
            res.status(200).json({ success: true, message: "Campaign published", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    activateCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const result = await this.service.activateCampaign(organizationId, req.params.id as string);
            res.status(200).json({ success: true, message: "Campaign activated", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    endCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const result = await this.service.endCampaign(organizationId, req.params.id as string);
            res.status(200).json({ success: true, message: "Campaign ended", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    archiveCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const result = await this.service.archiveCampaign(organizationId, req.params.id as string);
            res.status(200).json({ success: true, message: "Campaign archived", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getGroups = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const result = await this.service.getGroups(organizationId, req.params.id as string);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    replaceGroups = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const data = ReplaceGroupsSchema.parse(req.body);
            const result = await this.service.replaceGroups(organizationId, req.params.id as string, data);
            res.status(200).json({ success: true, message: "Ambassador structure saved", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    duplicateCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id: createdById, organizationId } = req.user!;
            const data = DuplicateCampaignSchema.parse(req.body);
            const result = await this.service.duplicateCampaign(organizationId, createdById, req.params.id as string, data);
            res.status(201).json({ success: true, message: "Campaign duplicated", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // ─── Campaign Templates ──────────────────────────────────────────────────────

    createTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id: createdById, organizationId } = req.user!;
            const data = CreateTemplateSchema.parse(req.body);
            const result = await this.service.createTemplate(organizationId, createdById, data);
            res.status(201).json({ success: true, message: "Template saved", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    listTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const query = ListTemplatesQuerySchema.parse(req.query);
            const result = await this.service.listTemplates(organizationId, query);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    deleteTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            await this.service.deleteTemplate(organizationId, req.params.id as string);
            res.status(200).json({ success: true, message: "Template deleted", data: null, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    instantiateTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id: createdById, organizationId } = req.user!;
            const data = InstantiateTemplateSchema.parse(req.body);
            const result = await this.service.instantiateTemplate(organizationId, createdById, req.params.id as string, data);
            res.status(201).json({ success: true, message: "Campaign created from template", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // ─── Report + leaderboard ────────────────────────────────────────────────────

    getCampaignStatsSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const result = await this.service.getCampaignStatsSummary(organizationId, req.params.id as string);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getCampaignReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const query = ListReportQuerySchema.parse(req.query);
            const result = await this.service.getCampaignReport(organizationId, req.params.id as string, query);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    exportCampaignReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const csv = await this.service.exportCampaignReportCsv(organizationId, req.params.id as string);
            res.status(200)
                .header("Content-Type", "text/csv")
                .header("Content-Disposition", `attachment; filename="ambassador-report-${req.params.id}.csv"`)
                .send(csv);
        } catch (err) {
            next(err);
        }
    };

    getCampaignLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const organizationId = req.user!.organizationId;
            const { scope, page, limit } = LeaderboardQuerySchema.parse(req.query);
            const result = await this.service.getCampaignLeaderboard(organizationId, req.params.id as string, scope, page, limit);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };
}
