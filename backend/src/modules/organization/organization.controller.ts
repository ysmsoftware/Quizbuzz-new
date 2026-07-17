import { Request, Response, NextFunction } from "express";
import { OrganizationService } from "./organization.service";
import { AdminAuthRepository } from "../admin/auth/admin-auth.repository";
import {
    updateOrganizationSchema,
    inviteMemberSchema,
    updateMemberRoleSchema,
    acceptInviteSchema,
    updateOrganizationProfileSchema,
} from "./organization.validator";

export class OrganizationController {
    constructor(
        private readonly orgService: OrganizationService,
        // Thin cross-domain injection: only used for findByEmail in inviteMember.
        private readonly adminRepo: AdminAuthRepository,
    ) { }

    // PATCH /organizations/:orgId/profile
    updateOrganizationProfile = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = req.params.orgId;
            if (!organizationId) {
                res.status(400).json({
                    success: false,
                    error: { code: "VALIDATION_ERROR", message: "Organization ID is required" },
                });
                return;
            }

            const parsed = updateOrganizationProfileSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: (parsed.error as any).errors[0].message,
                    },
                });
                return;
            }

            // Remove undefined properties to satisfy exactOptionalPropertyTypes
            const updateData = Object.fromEntries(
                Object.entries(parsed.data).filter(([_, v]) => v !== undefined)
            );

            const profile = await this.orgService.updateOrganizationProfile(
                organizationId as string,
                req.user!.id,
                updateData as any,
            );
            res.json({ success: true, data: profile });
        } catch (err) {
            next(err);
        }
    };

    // GET /organizations/:orgId
    getOrganization = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = req.params.orgId;
            if (!organizationId) {
                res.status(400).json({
                    success: false,
                    error: { code: "VALIDATION_ERROR", message: "Organization ID is required" },
                });
                return;
            }

            const org = await this.orgService.getWithDetails(organizationId as string);
            res.json({ success: true, data: org });
        } catch (err) {
            next(err);
        }
    };

    // PATCH /organizations/:orgId
    updateOrganization = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = req.params.orgId;
            if (!organizationId) {
                res.status(400).json({
                    success: false,
                    error: { code: "VALIDATION_ERROR", message: "Organization ID is required" },
                });
                return;
            }

            const parsed = updateOrganizationSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: (parsed.error as any).errors[0].message,
                    },
                });
                return;
            }

            // Remove undefined properties to satisfy exactOptionalPropertyTypes
            const updateData = Object.fromEntries(
                Object.entries(parsed.data).filter(([_, v]) => v !== undefined)
            );

            const org = await this.orgService.updateOrganization(
                organizationId as string,
                req.user!.id,
                updateData as any,
            );
            res.json({ success: true, data: org });
        } catch (err) {
            next(err);
        }
    };

    // GET /organizations/:orgId/members
    listMembers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = req.params.orgId;
            if (!organizationId) {
                res.status(400).json({
                    success: false,
                    error: { code: "VALIDATION_ERROR", message: "Organization ID is required" },
                });
                return;
            }

            const members = await this.orgService.listMembers(organizationId as string);
            res.json({ success: true, data: members });
        } catch (err) {
            next(err);
        }
    };

    // POST /organizations/:orgId/members/invite
    inviteMember = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = req.params.orgId;
            if (!organizationId) {
                res.status(400).json({
                    success: false,
                    error: { code: "VALIDATION_ERROR", message: "Organization ID is required" },
                });
                return;
            }

            const parsed = inviteMemberSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: (parsed.error as any).errors[0].message,
                    },
                });
                return;
            }

            const result = await this.orgService.inviteMember(
                organizationId as string,
                req.user!.id,
                parsed.data,
                this.adminRepo,
            );

            res.status(201).json({
                success: true,
                data: {
                    memberId: result.memberId,
                    email: result.email,
                    role: result.role,
                    message:
                        "Invite sent. The admin will receive an email with a link to join.",
                },
            });
        } catch (err) {
            next(err);
        }
    };

    // POST /organizations/invite/accept  (public — no org token yet)
    acceptInvite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = acceptInviteSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: (parsed.error as any).errors[0].message,
                    },
                });
                return;
            }

            await this.orgService.acceptInvite(parsed.data.token);
            res.json({
                success: true,
                message:
                    "You have successfully joined the organization. Please log in to continue.",
            });
        } catch (err) {
            next(err);
        }
    };

    // PATCH /organizations/:orgId/members/:memberId/role
    updateMemberRole = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = req.params.orgId;
            const memberId = req.params.memberId;
            if (!organizationId || !memberId) {
                res.status(400).json({
                    success: false,
                    error: { code: "VALIDATION_ERROR", message: "Organization ID and Member ID are required" },
                });
                return;
            }

            const parsed = updateMemberRoleSchema.safeParse(req.body);
            if (!parsed.success) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: (parsed.error as any).errors[0].message,
                    },
                });
                return;
            }

            const member = await this.orgService.updateMemberRole(
                organizationId as string,
                req.user!.id,
                memberId as string,
                parsed.data.role,
            );
            res.json({ success: true, data: member });
        } catch (err) {
            next(err);
        }
    };

    // DELETE /organizations/:orgId/members/:memberId
    removeMember = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = req.params.orgId;
            const memberId = req.params.memberId;
            if (!organizationId || !memberId) {
                res.status(400).json({
                    success: false,
                    error: { code: "VALIDATION_ERROR", message: "Organization ID and Member ID are required" },
                });
                return;
            }

            await this.orgService.removeMember(
                organizationId as string,
                req.user!.id,
                memberId as string,
            );
            res.json({
                success: true,
                message: "Member removed from the organization",
            });
        } catch (err) {
            next(err);
        }
    };
}