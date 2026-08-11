import crypto from "crypto";
import { OrganizationRepository } from "./organization.repository";
import { MessagingService } from "../messaging/messaging.service";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../error/http-errors";
import { createSlug } from "../../utils/slug";
import { config } from "../../config";
import { InviteMemberDTO, InviteMemberResult, OrgMemberResult, OrgMemberWithOrg, OrgWithMembersResult, OrganizationResult, UpdateOrganizationDTO, UpdateOrganizationProfileDTO, } from "./organization.types";
import { OrgMemberRole, OrganizationProfile } from "@prisma/client";
import { redis } from "../../config/redis";
import { prisma } from "../../config/db";
import { hashPassword } from "../../utils/password";
import { MessageTemplate } from "../../types/message-template.enum";
import logger from "../../config/logger";
// Plan-limit enforcement (org members) now runs as middleware ahead of this
// route — see src/middlewares/plan-limit.middleware.ts::enforceOrgMemberInviteLimit.
import { getPlanUsageSummary, PlanUsageSummary } from "../../common/plan-usage-summary";



const INVITE_KEY = (token: string) => `org:invite:${token}`;
const INVITE_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days


export class OrganizationService {
    constructor(
        private readonly organizationRepo: OrganizationRepository,
        private readonly messagingService: MessagingService,
    ) { }

    async getById(id: string) {
        const org = await this.organizationRepo.findById(id);
        if (!org) throw new NotFoundError("Organization not found");
        return org;
    }

    async getBySlug(slug: string) {
        const org = await this.organizationRepo.findBySlug(slug);
        if (!org) throw new NotFoundError("Organization not found");
        return org;
    }

    /** Current usage vs. plan limits — powers the Settings → Plan & Billing usage bars. */
    async getUsage(orgId: string): Promise<PlanUsageSummary> {
        await this.getById(orgId);
        return getPlanUsageSummary(orgId);
    }


    async getWithDetails(orgId: string): Promise<OrgWithMembersResult> {
        const org = await this.organizationRepo.findByIdWithCounts(orgId);
        if (!org) throw new NotFoundError("Organization not found");

        const members = await this.organizationRepo.findOrgMembers(orgId);

        return {
            ...this._toOrganizationResult(org),
            members: members.map((m) => ({
                id: m.id,
                adminId: m.adminId,
                role: m.role,
                isActive: m.isActive,
                invitedAt: m.invitedAt,
                acceptedAt: m.acceptedAt,
                admin: m.admin,
            })),
            _count: org._count,
            profile: org.profile,
        };
    }


    async updateOrganization(orgId: string, requestingAdminId: string, data: UpdateOrganizationDTO,): Promise<OrganizationResult> {
        await this._assertRole(requestingAdminId, orgId, [
            OrgMemberRole.OWNER,
            OrgMemberRole.ADMIN,
        ]);
        const updated = await this.organizationRepo.update(orgId, data);
        return this._toOrganizationResult(updated);
    }

    async updateOrganizationProfile(
        orgId: string,
        requestingAdminId: string,
        data: UpdateOrganizationProfileDTO
    ): Promise<OrganizationProfile> {
        await this._assertRole(requestingAdminId, orgId, [
            OrgMemberRole.OWNER,
            OrgMemberRole.ADMIN,
        ]);
        return this.organizationRepo.upsertProfile(orgId, data);
    }


    async getMembership(adminId: string, orgId: string): Promise<OrgMemberWithOrg> {
        const membership = await this.organizationRepo.findOrgMembership(adminId, orgId);
        if (!membership) {
            throw new NotFoundError("You are not a member of this organization");
        }
        return membership;
    }

    async listMemberships(adminId: string): Promise<OrgMemberWithOrg[]> {
        return this.organizationRepo.findAllOrgMemberships(adminId);
    }

    async listMembers(orgId: string): Promise<OrgMemberResult[]> {
        const members = await this.organizationRepo.findOrgMembers(orgId);
        return members.map((m) => ({
            id: m.id,
            adminId: m.adminId,
            role: m.role,
            isActive: m.isActive,
            invitedAt: m.invitedAt,
            acceptedAt: m.acceptedAt,
            admin: m.admin,
        }));
    }

    // invite
    // invite
    async inviteMember(
        orgId: string,
        requestingAdminId: string,
        dto: InviteMemberDTO,
        adminRepo: {
            findByEmail: (email: string | string[]) => Promise<{ id: string; firstName: string; email: string } | null>;
            findById?: (id: string) => Promise<{ id: string; firstName: string; lastName: string } | null>;
        },
    ): Promise<InviteMemberResult> {
        await this._assertRole(requestingAdminId, orgId, [OrgMemberRole.OWNER]);

        const targetAdmin = await adminRepo.findByEmail(dto.email);

        if (targetAdmin) {
            if (targetAdmin.id === requestingAdminId) {
                throw new BadRequestError("You cannot invite yourself.");
            }

            const existing = await this.organizationRepo.findPendingMembership(targetAdmin.id, orgId);
            if (existing) {
                if (existing.isActive) {
                    throw new ConflictError("This user is already an active member of the organization");
                }
                // Pending invite exists — just reissue the token
            } else {
                await this.organizationRepo.createMembership({
                    adminId: targetAdmin.id,
                    organizationId: orgId,
                    role: dto.role,
                });
            }
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const payload = JSON.stringify({
            email: dto.email,
            adminId: targetAdmin?.id ?? null,
            orgId,
            role: dto.role,
        });
        await redis.setex(INVITE_KEY(rawToken), INVITE_TTL_SECONDS, payload);

        // Enqueue invite email
        const org = await this.getById(orgId);
        const inviteLink = `${config.app.frontendUrl}/accept-invite?token=${rawToken}`;
        const requestingAdmin = adminRepo.findById ? await adminRepo.findById(requestingAdminId) : null;
        const inviterName = requestingAdmin ? `${requestingAdmin.firstName} ${requestingAdmin.lastName}`.trim() : undefined;
        const recipientName = targetAdmin ? targetAdmin.firstName : dto.email.split("@")[0];

        await this.messagingService.enqueueMessage(orgId, {
            channel: "EMAIL",
            template: MessageTemplate.ORG_INVITE,
            recipient: dto.email,
            params: {
                name: recipientName,
                orgName: org.name,
                inviteLink,
                inviterName,
                role: dto.role,
            },
        }).catch((err) => {
            logger.error(`[organization] Failed to enqueue invite email: ${(err as Error).message}`);
        });

        return {
            memberId: targetAdmin?.id ?? "",
            email: dto.email,
            role: dto.role,
            inviteToken: rawToken,
            inviteLink,
        };
    }

    async getInviteDetails(
        rawToken: string,
        adminRepo: { findByEmail: (email: string) => Promise<{ id: string; email: string } | null> }
    ) {
        const stored = await redis.get(INVITE_KEY(rawToken));
        if (!stored) {
            throw new BadRequestError("Invite link is invalid or has expired");
        }

        const { email, orgId, role } = JSON.parse(stored) as {
            email: string;
            adminId?: string | null;
            orgId: string;
            role: OrgMemberRole;
        };

        const org = await this.getById(orgId);
        const targetAdmin = await adminRepo.findByEmail(email);

        return {
            valid: true,
            email,
            orgId,
            orgName: org.name,
            role,
            hasAccount: !!targetAdmin,
        };
    }

    async acceptInvite(
        dto: {
            token: string;
            firstName?: string;
            lastName?: string;
            password?: string;
        },
        adminRepo: { findByEmail: (email: string) => Promise<{ id: string; email: string } | null> }
    ): Promise<{ admin: { id: string; email: string; firstName: string; lastName: string }; orgId: string }> {
        const stored = await redis.get(INVITE_KEY(dto.token));
        if (!stored) {
            throw new BadRequestError("Invite link is invalid or has expired");
        }

        const { email, orgId, role } = JSON.parse(stored) as {
            email: string;
            adminId?: string | null;
            orgId: string;
            role: OrgMemberRole;
        };

        let targetAdmin = await adminRepo.findByEmail(email);

        if (!targetAdmin) {
            if (!dto.firstName?.trim() || !dto.lastName?.trim() || !dto.password || dto.password.length < 6) {
                throw new BadRequestError(
                    "First name, last name, and a password (min 6 characters) are required to create your account."
                );
            }

            const passwordHash = await hashPassword(dto.password);
            targetAdmin = await prisma.admin.create({
                data: {
                    email,
                    passwordHash,
                    firstName: dto.firstName.trim(),
                    lastName: dto.lastName.trim(),
                    emailVerified: true,
                    emailVerifiedAt: new Date(),
                },
            });
        }

        const existing = await this.organizationRepo.findPendingMembership(targetAdmin.id, orgId);
        if (existing) {
            await this.organizationRepo.acceptMembership(targetAdmin.id, orgId);
        } else {
            await this.organizationRepo.createMembership({
                adminId: targetAdmin.id,
                organizationId: orgId,
                role: role,
            });
            await this.organizationRepo.acceptMembership(targetAdmin.id, orgId);
        }

        await redis.del(INVITE_KEY(dto.token));

        return {
            admin: targetAdmin as any,
            orgId,
        };
    }

    async updateMemberRole(
        orgId: string,
        requestingAdminId: string,
        memberId: string,
        role: OrgMemberRole,
    ): Promise<OrgMemberResult> {
        await this._assertRole(requestingAdminId, orgId, [OrgMemberRole.OWNER]);

        const member = await this.organizationRepo.findMemberById(memberId);
        if (!member || member.organizationId !== orgId) {
            throw new NotFoundError("Member not found in this organization");
        }

        if (member.adminId === requestingAdminId) {
            throw new BadRequestError(
                "You cannot change your own role. Ask another OWNER.",
            );
        }

        if (member.role === OrgMemberRole.OWNER && role !== OrgMemberRole.OWNER) {
            const ownerCount = await this.organizationRepo.countActiveOwners(orgId);
            if (ownerCount <= 1) {
                throw new BadRequestError(
                    "Cannot change role — this is the only OWNER. Promote another member first.",
                );
            }
        }

        await this.organizationRepo.updateMemberRole(memberId, role);

        const members = await this.organizationRepo.findOrgMembers(orgId);
        const updated = members.find((m) => m.id === memberId);
        if (!updated) throw new NotFoundError("Member not found after update");

        return {
            id: updated.id,
            adminId: updated.adminId,
            role: updated.role,
            isActive: updated.isActive,
            invitedAt: updated.invitedAt,
            acceptedAt: updated.acceptedAt,
            admin: updated.admin,
        };
    }


    async removeMember(
        orgId: string,
        requestingAdminId: string,
        memberId: string,
    ): Promise<void> {
        await this._assertRole(requestingAdminId, orgId, [OrgMemberRole.OWNER]);

        const member = await this.organizationRepo.findMemberById(memberId);
        if (!member || member.organizationId !== orgId) {
            throw new NotFoundError("Member not found in this organization");
        }

        if (member.adminId === requestingAdminId) {
            throw new BadRequestError(
                "You cannot remove yourself. Transfer ownership first.",
            );
        }

        if (member.role === OrgMemberRole.OWNER) {
            const ownerCount = await this.organizationRepo.countActiveOwners(orgId);
            if (ownerCount <= 1) {
                throw new BadRequestError(
                    "Cannot remove the last OWNER. Promote another member first.",
                );
            }
        }

        await this.organizationRepo.deactivateMember(memberId);
    }
    async generateUniqueSlug(name: string): Promise<string> {
        let slug = createSlug(name);
        let attempt = 0;

        while (attempt <= config.app.maxSlugRetries) {
            const suffix = attempt > 0 ? `-${attempt}` : "";
            const candidate = `${slug}${suffix}`;
            const existing = await this.organizationRepo.findBySlug(candidate);
            if (!existing) return candidate;
            attempt++;
        }

        throw new BadRequestError("Could not generate a unique org slug");
    }


    // ─── Private helpers ──────────────────────────────────────────────────────

    private async _assertRole(
        adminId: string,
        orgId: string,
        allowedRoles: OrgMemberRole[],
    ): Promise<void> {
        const membership = await this.organizationRepo.findOrgMembership(adminId, orgId);
        if (!membership || !membership.isActive) {
            throw new ForbiddenError("You are not an active member of this organization");
        }
        if (!allowedRoles.includes(membership.role)) {
            throw new ForbiddenError(
                `Insufficient permissions. Required: ${allowedRoles.join(" or ")}`,
            );
        }
    }



    private _toOrganizationResult(org: {
        id: string;
        name: string;
        slug: string;
        logoUrl: string | null;
        website: string | null;
        isActive: boolean;
        createdAt: Date;
        planSlug?: string | null;
        planStatus?: string | null;
        planLimitsCache?: unknown;
    }): OrganizationResult {
        return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            logoUrl: org.logoUrl,
            website: org.website,
            isActive: org.isActive,
            createdAt: org.createdAt,
            planSlug: org.planSlug ?? null,
            planStatus: org.planStatus ?? null,
            planLimitsCache: (org.planLimitsCache as Record<string, any> | null) ?? null,
        };
    }
}
