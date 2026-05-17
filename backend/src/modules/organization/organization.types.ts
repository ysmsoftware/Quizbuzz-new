import { OrgMemberRole } from "@prisma/client";

// ─── Input DTOs ───────────────────────────────────────────────────────────────

export interface UpdateOrganizationDTO {
    name?: string;
    logoUrl?: string;
    website?: string;
}

export interface InviteMemberDTO {
    email: string;
    role: OrgMemberRole;
}

export interface UpdateMemberRoleDTO {
    role: OrgMemberRole;
}

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface OrganizationResult {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    website: string | null;
    isActive: boolean;
    createdAt: Date;
}

export interface OrgMemberResult {
    id: string;
    adminId: string;
    role: OrgMemberRole;
    isActive: boolean;
    invitedAt: Date;
    acceptedAt: Date | null;
    admin: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
    };
}

export interface OrgWithMembersResult extends OrganizationResult {
    members: OrgMemberResult[];
    _count: {
        members: number;
        contests: number;
    };
}

export interface InviteMemberResult {
    memberId: string;
    email: string;
    role: OrgMemberRole;
    inviteToken: string;
}

// ─── Internal typed joins ─────────────────────────────────────────────────────

export type OrgMemberWithOrg = {
    id: string;
    adminId: string;
    organizationId: string;
    role: OrgMemberRole;
    isActive: boolean;
    invitedAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    organization: {
        id: string;
        name: string;
        slug: string;
    };
};

export type OrgMemberWithAdmin = {
    id: string;
    adminId: string;
    organizationId: string;
    role: OrgMemberRole;
    isActive: boolean;
    invitedAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    admin: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
    };
};