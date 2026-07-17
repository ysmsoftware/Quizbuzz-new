import crypto from "crypto";
import { OrganizationRepository } from "./organization.repository";
import { MessagingService } from "../messaging/messaging.service";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../error/http-errors";
import { createSlug } from "../../utils/slug";
import { config } from "../../config";
import { InviteMemberDTO, InviteMemberResult, OrgMemberResult, OrgMemberWithOrg, OrgWithMembersResult, OrganizationResult, UpdateOrganizationDTO, UpdateOrganizationProfileDTO, } from "./organization.types";
import { OrgMemberRole, OrganizationProfile } from "@prisma/client";
import { redis } from "../../config/redis";
import { MessageTemplate } from "../../types/message-template.enum";
import logger from "../../config/logger";



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
    async inviteMember(
        orgId: string,
        requestingAdminId: string,
        dto: InviteMemberDTO,
        adminRepo: { findByEmail: (email: string) => Promise<{ id: string; firstName: string } | null> },
    ): Promise<InviteMemberResult> {
        await this._assertRole(requestingAdminId, orgId, [OrgMemberRole.OWNER]);

        const targetAdmin = await adminRepo.findByEmail(dto.email);
        if (!targetAdmin) {
            throw new NotFoundError(
                "No admin account found with that email. The user must register first.",
            );
        }

        if (targetAdmin.id === requestingAdminId) {
            throw new BadRequestError("You cannot invite yourself.");
        }

        const existing = await this.organizationRepo.findPendingMembership(targetAdmin.id, orgId);
        if (existing) {
            if (existing.isActive) {
                throw new ConflictError("This admin is already an active member of the organization");
            }
            // Pending invite exists — just reissue the token (idempotent)
        } else {
            await this.organizationRepo.createMembership({
                adminId: targetAdmin.id,
                organizationId: orgId,
                role: dto.role,
            });
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const payload = JSON.stringify({ adminId: targetAdmin.id, orgId, role: dto.role });
        await redis.setex(INVITE_KEY(rawToken), INVITE_TTL_SECONDS, payload);

        // Enqueue invite email
        const org = await this.getById(orgId);
        const inviteLink = `${config.app.frontendUrl}/accept-invite?token=${rawToken}`;

        await this.messagingService.enqueueMessage(orgId, {
            channel: "EMAIL",
            template: MessageTemplate.ORG_INVITE,
            recipient: dto.email,
            params: {
                name: targetAdmin.firstName,
                orgName: org.name,
                inviteLink,
            },
        }).catch((err) => {
            logger.error(`[organization] Failed to enqueue invite email: ${(err as Error).message}`);
        });

        return {
            memberId: targetAdmin.id,
            email: dto.email,
            role: dto.role,
            inviteToken: rawToken,
        };
    }

    async acceptInvite(rawToken: string): Promise<void> {
        const stored = await redis.get(INVITE_KEY(rawToken));
        if (!stored) {
            throw new BadRequestError("Invite link is invalid or has expired");
        }

        const { adminId, orgId } = JSON.parse(stored) as {
            adminId: string;
            orgId: string;
            role: OrgMemberRole;
        };

        await this.organizationRepo.acceptMembership(adminId, orgId);
        await redis.del(INVITE_KEY(rawToken));
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
    }): OrganizationResult {
        return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            logoUrl: org.logoUrl,
            website: org.website,
            isActive: org.isActive,
            createdAt: org.createdAt,
        };
    }
}
