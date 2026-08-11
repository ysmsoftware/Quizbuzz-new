import { Request, Response, NextFunction } from "express";
import { AmbassadorCampaignService } from "./ambassador-campaign.service";
import { storageService } from "../../services/storage.service";
import { BadRequestError, UnauthorizedError } from "../../error/http-errors";
import {
    CreateCampaignSchema,
    UpdateCampaignSchema,
    DuplicateCampaignSchema,
    ListCampaignsQuerySchema,
    ListApplicationsQuerySchema,
    RejectApplicationSchema,
    ListReportQuerySchema,
    LeaderboardQuerySchema,
} from "./ambassador-campaign.validator";

export class AmbassadorCampaignController {

    constructor(private readonly service: AmbassadorCampaignService) { }

    /**
     * POST /org/ambassadors/campaigns/upload-poster
     * Same base64-body upload shape as ContestController.uploadBanner — a
     * campaign poster is the same kind of asset (org-admin-supplied marketing
     * image), not the presigned-PUT-URL flow the ambassador-proof upload uses.
     */
    uploadPoster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = req.user;
            if (!user) {
                throw new UnauthorizedError("User not authorized.");
            }
            const { fileData, fileName } = req.body;
            if (!fileData || !fileName) {
                throw new BadRequestError("File data and file name are required.");
            }

            // Data URL format: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
            const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            let buffer: Buffer;
            let contentType: string;

            if (matches && matches.length === 3) {
                contentType = matches[1];
                buffer = Buffer.from(matches[2], "base64");
            } else {
                contentType = "image/png";
                buffer = Buffer.from(fileData, "base64");
            }

            const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
            const key = `ambassador-posters/${user.organizationId}/${Date.now()}_${cleanFileName}`;

            const uploadResult = await storageService.upload(key, buffer, contentType);

            res.status(200).json({
                success: true,
                message: "Poster uploaded successfully",
                data: { url: uploadResult.url, key: uploadResult.key },
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

    // ─── Report + leaderboard ────────────────────────────────────────────────────

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
