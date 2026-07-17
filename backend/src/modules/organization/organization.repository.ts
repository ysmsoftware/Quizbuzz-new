import { OrgMember, OrgMemberRole, Organization, OrganizationProfile } from "@prisma/client";
import { prisma } from "../../config/db";
import { OrgMemberWithAdmin, OrgMemberWithOrg } from "./organization.types";

export class OrganizationRepository {

    async findById(id: string): Promise<Organization | null> {
        return prisma.organization.findUnique({
            where: { id, isDeleted: false },
        });
    }

    async findBySlug(slug: string): Promise<Organization | null> {
        return prisma.organization.findUnique({
            where: { slug, isDeleted: false },
        });
    }

    async findByIdWithCounts(id: string): Promise<
        (Organization & { _count: { members: number; contests: number }; profile: OrganizationProfile | null }) | null
    > {
        return prisma.organization.findUnique({
            where: { id, isDeleted: false },
            include: {
                _count: {
                    select: { members: true, contests: true },
                },
                profile: true,
            },
        });
    }

    async upsertProfile(orgId: string, data: any): Promise<OrganizationProfile> {
        return prisma.organizationProfile.upsert({
            where: { organizationId: orgId },
            create: { organizationId: orgId, ...data },
            update: data,
        });
    }

    async update(id: string, data: {
        name?: string;
        logoUrl?: string;
        website?: string;
    }): Promise<Organization> {
        return prisma.organization.update({
            where: { id },
            data,
        });
    }

    async softDelete(id: string): Promise<void> {
        await prisma.organization.update({
            where: { id },
            data: { isDeleted: true, isActive: false },
        });
    }

    // ─── Membership queries ───────────────────────────────────────────────────

    /**
     * Find a single membership, typed to include the nested org.
     * Used by AdminAuthService.switchOrg — typed return removes the need for `as any`.
     */
    async findOrgMembership(
        adminId: string,
        orgId: string,
    ): Promise<OrgMemberWithOrg | null> {
        return prisma.orgMember.findUnique({
            where: {
                organizationId_adminId: {
                    organizationId: orgId,
                    adminId,
                },
            },
            include: {
                organization: {
                    select: { id: true, name: true, slug: true },
                },
            },
        }) as Promise<OrgMemberWithOrg | null>;
    }

    /**
     * All active memberships for an admin, typed to include nested org.
     * Used by AdminAuthService.login (picking default org) and getMe.
     */
    async findAllOrgMemberships(adminId: string): Promise<OrgMemberWithOrg[]> {
        return prisma.orgMember.findMany({
            where: { adminId, isActive: true },
            include: {
                organization: {
                    select: { id: true, name: true, slug: true },
                },
            },
            orderBy: { invitedAt: "asc" },
        }) as Promise<OrgMemberWithOrg[]>;
    }

    /**
     * All members of an org, typed to include nested admin profile.
     * Used by OrganizationService.listMembers.
     */
    async findOrgMembers(orgId: string): Promise<OrgMemberWithAdmin[]> {
        return prisma.orgMember.findMany({
            where: { organizationId: orgId, isActive: true },
            include: {
                admin: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                    },
                },
            },
            orderBy: { invitedAt: "asc" },
        }) as Promise<OrgMemberWithAdmin[]>;
    }

    async findMemberById(memberId: string): Promise<OrgMember | null> {
        return prisma.orgMember.findUnique({
            where: { id: memberId },
        });
    }

    async findPendingMembership(
        adminId: string,
        orgId: string,
    ): Promise<OrgMember | null> {
        return prisma.orgMember.findUnique({
            where: {
                organizationId_adminId: {
                    organizationId: orgId,
                    adminId,
                },
            },
        });
    }

    // ─── Membership mutations ─────────────────────────────────────────────────

    async createMembership(data: {
        adminId: string;
        organizationId: string;
        role: OrgMemberRole;
    }): Promise<OrgMember> {
        return prisma.orgMember.create({
            data: {
                adminId: data.adminId,
                organizationId: data.organizationId,
                role: data.role,
                // acceptedAt intentionally null — set when invite is accepted
            },
        });
    }

    async acceptMembership(
        adminId: string,
        orgId: string,
    ): Promise<OrgMember> {
        return prisma.orgMember.update({
            where: {
                organizationId_adminId: {
                    organizationId: orgId,
                    adminId,
                },
            },
            data: {
                isActive: true,
                acceptedAt: new Date(),
            },
        });
    }

    async updateMemberRole(
        memberId: string,
        role: OrgMemberRole,
    ): Promise<OrgMember> {
        return prisma.orgMember.update({
            where: { id: memberId },
            data: { role },
        });
    }

    async deactivateMember(memberId: string): Promise<void> {
        await prisma.orgMember.update({
            where: { id: memberId },
            data: { isActive: false },
        });
    }

    // ─── Guard helpers ────────────────────────────────────────────────────────

    /** Count active OWNERs — used to prevent removing the last owner. */
    async countActiveOwners(orgId: string): Promise<number> {
        return prisma.orgMember.count({
            where: {
                organizationId: orgId,
                role: OrgMemberRole.OWNER,
                isActive: true,
            },
        });
    }
}