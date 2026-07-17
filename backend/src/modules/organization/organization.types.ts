import { OrgMemberRole, OrganizationProfile } from "@prisma/client";

// ─── Input DTOs ───────────────────────────────────────────────────────────────

export interface UpdateOrganizationDTO {
    name?: string;
    logoUrl?: string;
    website?: string;
}

export interface UpdateOrganizationProfileDTO {
    primaryUseCase?:           string;
    useCaseOther?:            string;
    sizeBucket?:               string;
    expectedContestsPerMonth?: string;
    expectedParticipants?:     string;
    heardAboutSource?:         string;
    heardAboutOther?:          string;
    primaryContactName?:       string;
    primaryContactPhone?:      string;
    primaryContactEmail?:      string;
    country?:                  string;
    state?:                    string;
    city?:                     string;
    timezone?:                 string;
    preferredCurrency?:        string;
    gstNumber?:                string;
    billingAddress?:           string;
    marketingOptIn?:           boolean;
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
    profile: OrganizationProfile | null;
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