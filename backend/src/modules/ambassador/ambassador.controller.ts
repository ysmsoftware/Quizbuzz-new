import { Request, Response, NextFunction } from "express";
import { config } from "../../config";
import { AmbassadorService } from "./ambassador.service";
import {
    SignupStartSchema,
    SignupVerifyOtpSchema,
    SignupCompleteSchema,
    UploadProofRequestSchema,
    RequestOtpSchema,
    VerifyOtpSchema,
    ListCampaignsQuerySchema,
    LeaderboardQuerySchema,
    ActivityQuerySchema,
    GetOrgTypesQuerySchema,
    UpdateProfileSchema,
    UpdateProofSchema,
    UpdateProfileImageSchema,
} from "./ambassador.validator";

export class AmbassadorController {

    constructor(private readonly service: AmbassadorService) { }

    // ─── Public catalog + upload ─────────────────────────────────────────────────

    /** Platform-wide catalog — used by the generic ambassador signup flow. */
    getPlatformTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await this.service.getPlatformTypes();
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    /** Org-scoped catalog — used by org-admin campaign config screens. */
    getTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { organizationId } = GetOrgTypesQuerySchema.parse(req.query);
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

    /** Unauthenticated — a shareable campaign link (ads, socials) has to render before anyone
     *  has signed up. */
    getPublicCampaignPreview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await this.service.getPublicCampaignPreview(req.params.id as string);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    /** Unauthenticated — backs the "campaigns accepting applications" section on the
     *  /ambassador landing page, which has to render before anyone has signed up. */
    listPublicCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { page, limit } = ListCampaignsQuerySchema.parse(req.query);
            const result = await this.service.listPublicCampaigns(page, limit);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    // ─── Signup (2-step) ─────────────────────────────────────────────────────────

    signupStart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = SignupStartSchema.parse(req.body);
            await this.service.signupStart(data);
            res.status(200).json({ success: true, message: "OTP sent to your email", requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    signupVerifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, otp } = SignupVerifyOtpSchema.parse(req.body);
            const result = await this.service.signupVerifyOtp(email, otp);
            res.status(200).json({ success: true, message: "OTP verified", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    signupComplete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const data = SignupCompleteSchema.parse(req.body);
            const result = await this.service.signupComplete(data);

            const { domain, secure, sameSite } = config.auth.cookie;
            res.cookie("ambassadorToken", result.token, {
                httpOnly: true,
                secure,
                sameSite: sameSite as any,
                domain: domain || undefined,
                path: "/",
                maxAge: result.expiresIn * 1000,
            });

            res.status(201).json({
                success: true,
                message: "Signup complete",
                data: { expiresIn: result.expiresIn },
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    // ─── Login (returning ambassador) ───────────────────────────────────────────

    requestOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email } = RequestOtpSchema.parse(req.body);
            await this.service.requestOtp(email);
            res.status(200).json({ success: true, message: "OTP sent to your email", requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, otp } = VerifyOtpSchema.parse(req.body);
            const result = await this.service.verifyOtp(email, otp);

            const { domain, secure, sameSite } = config.auth.cookie;
            res.cookie("ambassadorToken", result.token, {
                httpOnly: true,
                secure,
                sameSite: sameSite as any,
                domain: domain || undefined,
                path: "/",
                maxAge: result.expiresIn * 1000,
            });

            res.status(200).json({
                success: true,
                message: "OTP verified",
                data: { expiresIn: result.expiresIn },
                requestId: req.id,
            });
        } catch (err) {
            next(err);
        }
    };

    // ─── Ambassador-authenticated ────────────────────────────────────────────────

    getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const result = await this.service.getMe(id);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const data = UpdateProfileSchema.parse(req.body);
            const result = await this.service.updateProfile(id, data);
            res.status(200).json({ success: true, message: "Profile updated", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { domain, secure, sameSite } = config.auth.cookie;
            res.clearCookie("ambassadorToken", { httpOnly: true, secure, sameSite: sameSite as any, domain: domain || undefined, path: "/" });
            res.status(200).json({ success: true, message: "Logged out", requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getAuthenticatedUploadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const data = UploadProofRequestSchema.parse(req.body);
            const result = await this.service.getAuthenticatedUploadUrl(id, data);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    updateProof = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const data = UpdateProofSchema.parse(req.body);
            const result = await this.service.updateProof(id, data);
            res.status(200).json({ success: true, message: "Proof document updated", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getProfileImageUploadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const data = UploadProofRequestSchema.parse(req.body);
            const result = await this.service.getProfileImageUploadUrl(id, data);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    updateProfileImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const data = UpdateProfileImageSchema.parse(req.body);
            const result = await this.service.updateProfileImage(id, data);
            res.status(200).json({ success: true, message: "Profile photo updated", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    listAvailableCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const { page, limit } = ListCampaignsQuerySchema.parse(req.query);
            const result = await this.service.listAvailableCampaigns(id, page, limit);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    listMyCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const { page, limit } = ListCampaignsQuerySchema.parse(req.query);
            const result = await this.service.listMyCampaigns(id, page, limit);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    applyToCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const result = await this.service.applyToCampaign(id, req.params.campaignId as string);
            res.status(201).json({ success: true, message: "Application submitted", data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getCampaignStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const result = await this.service.getCampaignStats(id, req.params.campaignId as string);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getCampaignLeaderboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { scope, page, limit } = LeaderboardQuerySchema.parse(req.query);
            const result = await this.service.getCampaignLeaderboard(
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

    getCampaignSocialProof = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const result = await this.service.getCampaignSocialProof(id, req.params.campaignId as string);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };

    getMyActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.ambassador!;
            const { days } = ActivityQuerySchema.parse(req.query);
            const result = await this.service.getMyActivity(id, days);
            res.status(200).json({ success: true, data: result, requestId: req.id });
        } catch (err) {
            next(err);
        }
    };
}
