import { Request, Response, NextFunction } from "express";
import { config } from "../../config";
import { AmbassadorService } from "./ambassador.service";
import {
    ApplySchema,
    UploadProofRequestSchema,
    RequestOtpSchema,
    VerifyOtpSchema,
    ListCampaignsQuerySchema,
    LeaderboardQuerySchema,
    GetTypesQuerySchema,
} from "./ambassador.validator";

export class AmbassadorController {

    constructor(private readonly service: AmbassadorService) { }

    // ─── Public (5.1) ───────────────────────────────────────────────────────────

    getTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { organizationId } = GetTypesQuerySchema.parse(req.query);
            const result = await this.service.getTypes(organizationId);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getUploadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = UploadProofRequestSchema.parse(req.body);
            const result = await this.service.getUploadUrl(data);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    apply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = ApplySchema.parse(req.body);
            const result = await this.service.apply(data);
            res.status(201).json({ success: true, message: "Application submitted", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    requestOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, organizationId } = RequestOtpSchema.parse(req.body);
            await this.service.requestOtp(email, organizationId);
            res.status(200).json({ success: true, message: "OTP sent to your email", requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, organizationId, otp } = VerifyOtpSchema.parse(req.body);
            const result = await this.service.verifyOtp(email, organizationId, otp);

            const { domain, secure, sameSite } = config.auth.cookie;
            res.cookie("ambassadorToken", result.token, {
                httpOnly: true,
                secure,
                sameSite: sameSite as any,
                domain: domain || undefined,
                maxAge: result.expiresIn * 1000,
            });

            res.status(200).json({
                success: true,
                message: "OTP verified",
                data: { status: result.status, expiresIn: result.expiresIn },
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    // ─── Ambassador-authenticated (§5.2) ────────────────────────────────────────

    getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id, organizationId } = req.ambassador!;
            const result = await this.service.getMe(id, organizationId);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    listAvailableCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id, organizationId } = req.ambassador!;
            const { page, limit } = ListCampaignsQuerySchema.parse(req.query);
            const result = await this.service.listAvailableCampaigns(id, organizationId, page, limit);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    listMyCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id, organizationId } = req.ambassador!;
            const { page, limit } = ListCampaignsQuerySchema.parse(req.query);
            const result = await this.service.listMyCampaigns(id, organizationId, page, limit);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    joinCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id, organizationId } = req.ambassador!;
            const result = await this.service.joinCampaign(id, organizationId, req.params.campaignId as string);
            res.status(201).json({ success: true, message: "Joined campaign", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getCampaignStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id, organizationId } = req.ambassador!;
            const result = await this.service.getCampaignStats(id, organizationId, req.params.campaignId as string);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getCampaignLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { organizationId } = req.ambassador!;
            const { scope, page, limit } = LeaderboardQuerySchema.parse(req.query);
            const result = await this.service.getCampaignLeaderboard(
                organizationId,
                req.params.campaignId as string,
                scope,
                page,
                limit,
            );
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };
}
