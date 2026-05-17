// Admin Auth - Types & DTOs


// Input DTOs

export interface RegisterAdminDTO {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

export interface LoginAdminDTO {
    email: string;
    password: string;
}

export interface SwitchOrgDTO {
    organizationId: string;
}

export interface VerifyEmailDTO {
    token: string;
}

export interface ForgotPasswordDTO {
    email: string;
}

export interface ResetPasswordDTO {
    token: string;
    newPassword: string;
}

// device info

export interface DeviceInfo {
    ipAddress: string;
    userAgent: string;
}


// Result types

export interface RegisterAdminResult {
    adminId: string;
    email: string;
    firstName: string;
    emailVerified: false; 
    organization: {
        id: string,
        name: string,
        slug: string,
    }
}

export interface AdminProfile {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    emailVerified: boolean;
}

export interface OrgMembershipResult {
    id: string;
    name: string;
    slug: string;
    role: string;
}

export interface LoginAdminResult {
    admin: AdminProfile;
    activeOrganization: OrgMembershipResult;
    tokens: TokenPair;
}

export interface GetMeResult {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    organizations: OrgMembershipResult[];
}

export interface SwitchOrgRedult {
    organization: {
        id: string;
        name: string;
        slug: string;
    };
    tokens: TokenPair;
}


// 
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

// 
export interface CreateAdminInput {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
}

export interface CreateRefreshTokenInput {
    adminId: string;
    tokenHash: string;
    deviceInfo: string;
    ipAddress: string;
    expiresAt: Date;
}