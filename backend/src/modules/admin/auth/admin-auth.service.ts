import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../../error/http-errors";
import { comparePassword, hashPassword } from "../../../utils/password";
import { AdminAuthRepository } from "./admin-auth.repository";
import { OrganizationService } from "../../organization/organization.service";
import { MessagingService } from "../../messaging/messaging.service";
import { DeviceInfo, GetMeResult, LoginAdminDTO, LoginAdminResult, RegisterAdminDTO, RegisterAdminResult, SwitchOrgRedult, TokenPair } from "./admin-auth.types";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../../../utils/jwt";
import { sendResetPasswordEmail } from "../../../providers/email.provider";
import { MessageTemplate } from "../../../types/message-template.enum";
import crypto from 'crypto'
import { config } from "../../../config";
import { redis } from "../../../config/redis";
import logger from "../../../config/logger";

export class AdminAuthService {

    constructor(
        private readonly repo: AdminAuthRepository,
        private readonly organizationService: OrganizationService,
        private readonly messagingService: MessagingService,
    ) { }


    async register(data: RegisterAdminDTO): Promise<RegisterAdminResult> {

        const existing = await this.repo.findByEmail(data.email);
        if (existing) {
            if (existing.emailVerified) {
                throw new ConflictError("An account with this email already exists");
            }
            // Delete the unverified registration attempt to allow a fresh, clean signup
            await this.repo.deleteUnverifiedAdmin(existing.id);
        }

        const passwordHash = await hashPassword(data.password);

        const orgName = `${data.firstName}'s Organization`;
        const orgSlug = await this.organizationService.generateUniqueSlug(orgName);

        const { admin, organization } = await this.repo.createWithOrganization({
            adminData: {
                email: data.email,
                passwordHash,
                firstName: data.firstName,
                lastName: data.lastName,
            },
            orgData: {
                name: orgName,
                slug: orgSlug,
            },
        });

        // Enqueue email verification job
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await redis.setex(`auth:email-verify:otp:${admin.email}`, 900, otp); // 15 min TTL

        await this.messagingService.enqueueMessage(organization.id, {
            channel: "EMAIL",
            template: MessageTemplate.ADMIN_EMAIL_OTP,
            recipient: admin.email,
            params: { name: admin.firstName, otp },
        }).catch((err) => {
            logger.error(`[admin-auth] Failed to enqueue verification email: ${(err as Error).message}`);
        });

        return {
            adminId: admin.id,
            email: admin.email,
            firstName: admin.firstName,
            emailVerified: false,
            organization: {
                id: organization.id,
                name: organization.name,
                slug: organization.slug
            }
        }
    }

    async login(data: LoginAdminDTO, device: DeviceInfo): Promise<LoginAdminResult> {

        const admin = await this.repo.findByEmail(data.email);

        const passwordMatch = admin
            ? await comparePassword(data.password, admin.passwordHash)
            : await comparePassword(data.password, "$2b$12$invalidhashfortimingnull")

        if (!admin || !passwordMatch) {
            throw new UnauthorizedError("Invalid email or password");
        }

        if (!admin.isActive || admin.isDeleted) {
            throw new UnauthorizedError("Account is inactive. Please contact support.");
        }

        if (!admin.emailVerified) {
            throw new ForbiddenError("Please verify your email before logging in.");
        }

        const memberships = await this.organizationService.listMemberships(admin.id);
        const defaultOrg = memberships[0];

        if (!defaultOrg) {
            throw new ForbiddenError("No organization found. Please ask an owner to invite you");
        }
        // create a tokens & store 
        const tokens = await this._issueTokenPairAndStore(admin.id, defaultOrg.organizationId, device);
        await this.repo.updateById(admin.id, { lastLoginAt: new Date() });

        return {
            admin: {
                id: admin.id,
                email: admin.email,
                firstName: admin.firstName,
                lastName: admin.lastName,
                avatarUrl: admin.avatarUrl,
                emailVerified: admin.emailVerified,
            },
            activeOrganization: {
                id: defaultOrg.organization.id,
                name: defaultOrg.organization.name,
                slug: defaultOrg.organization.slug,
                role: defaultOrg.role,
            },
            tokens,

        }


    }

    async refresh(rawRefreshToken: string, device: DeviceInfo): Promise<TokenPair> {
        // Verify signature
        const payload = verifyRefreshToken(rawRefreshToken);

        // hash the token to look up DB record
        const hash = this._hashToken(rawRefreshToken);
        const record = await this.repo.findRefreshTokenByHash(hash);

        if (!record || record.revokedAt !== null) {
            // if token was revokerd, possible replay attack - revoke all tokens
            if (record?.adminId) {
                await this.repo.revokeAllRefreshTokenByAdmin(record.adminId);
            }
            throw new UnauthorizedError("Refresh token is invalid or revoked");
        }

        if (record.expiresAt < new Date()) {
            throw new UnauthorizedError("Refresh token has expired. Please login again.");
        }

        // Revoke old token (rotaion)
        await this.repo.revokeRefreshToken(hash);

        // issue new token's
        return this._issueTokenPairAndStore(payload.userId, payload.organizationId, device);

    }

    async logout(rawRefreshToken: string): Promise<void> {
        const hash = this._hashToken(rawRefreshToken);
        const record = await this.repo.findRefreshTokenByHash(hash);

        if (record && !record.revokedAt) {
            await this.repo.revokeRefreshToken(hash);
        }
    }

    async logoutAll(adminId: string): Promise<void> {
        await this.repo.revokeAllRefreshTokenByAdmin(adminId);
    }


    async getMe(adminId: string): Promise<GetMeResult> {
        const admin = await this.repo.findById(adminId);

        if (!admin || admin.isDeleted) {
            throw new NotFoundError("Admin not found");
        }

        const organizations = await this.getOrgs(adminId);

        return {
            id: admin.id,
            email: admin.email,
            firstName: admin.firstName,
            lastName: admin.lastName,
            avatarUrl: admin.avatarUrl || null,
            emailVerified: admin.emailVerified,
            organizations
        }
    }

    async getOrgs(adminId: string) {
        const memberships = await this.organizationService.listMemberships(adminId);
        return memberships.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            role: m.role,
        }));
    }

    async switchOrg(adminId: string, orgId: string, device: DeviceInfo): Promise<SwitchOrgRedult> {

        const membership = await this.organizationService.getMembership(adminId, orgId);
        if (!membership || !membership.isActive) {
            throw new ForbiddenError("You are not a member of this organization");
        }

        const tokens = await this._issueTokenPairAndStore(adminId, orgId, device);

        return {
            organization: {
                id: membership.organizationId,
                name: (membership as any).organization.name,
                slug: (membership as any).organization.slug,
            },
            tokens,
        };
    }

    async verifyEmail(email: string, otp: string): Promise<void> {
        const key = `auth:email-verify:otp:${email}`;
        const stored = await redis.get(key);

        if (!stored) throw new BadRequestError("OTP has expired or was never sent. Please request a new one.");
        if (stored !== otp) throw new BadRequestError("Invalid OTP. Please try again.");

        const admin = await this.repo.findByEmail(email);
        if (!admin) throw new BadRequestError("No account found for this email.");
        if (admin.emailVerified) throw new BadRequestError("Email is already verified.");

        await this.repo.updateById(admin.id, {
            emailVerified: true,
            emailVerifiedAt: new Date(),
        });

        await redis.del(key);
    }

    async resendVerificationOtp(email: string): Promise<void> {
        const admin = await this.repo.findByEmail(email);
        if (!admin || admin.isDeleted) return; // silent — don't reveal existence

        if (admin.emailVerified) throw new BadRequestError("Email is already verified.");

        const memberships = await this.organizationService.listMemberships(admin.id);
        const orgId = memberships[0]?.organizationId;
        if (!orgId) return;

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await redis.setex(`auth:email-verify:otp:${email}`, 900, otp);

        await this.messagingService.enqueueMessage(orgId, {
            channel: "EMAIL",
            template: MessageTemplate.ADMIN_EMAIL_OTP,
            recipient: email,
            params: { name: admin.firstName, otp },
        }).catch((err) => {
            logger.error(`[admin-auth] Failed to enqueue resend OTP: ${(err as Error).message}`);
        });
    }

    async forgotPassword(email: string): Promise<void> {

        const admin = await this.repo.findByEmail(email);
        if (!admin || admin.isDeleted) return; // silent return


        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = this._hashToken(resetToken);
        const ttlSeconds = config.auth.jwt.refreshTtl;

        await redis.setex(`auth:pwd-reset:${tokenHash}`, ttlSeconds, admin.id);

        // Send password reset email directly (auth-critical — not queued)
        const resetLink = `${config.app.frontendUrl}/reset-password?token=${resetToken}`;
        await sendResetPasswordEmail(admin.email, admin.firstName, resetLink);
    }

    async resetPassword(token: string, newPassword: string): Promise<void> {
        const tokenHash = this._hashToken(token);
        const key = `auth:pwd-reset:${tokenHash}`;

        const adminId = await redis.get(key);
        if (!adminId) {
            throw new BadRequestError("Reset link is invaild or has expired");
        }

        const passwordHash = await hashPassword(newPassword);

        await this.repo.updateById(adminId, { passwordHash });
        await this.repo.revokeAllRefreshTokenByAdmin(adminId);
        await redis.del(key);
    }



    // helpers
    private async _issueTokenPairAndStore(
        adminId: string,
        organizationId: string,
        device: DeviceInfo,
    ): Promise<TokenPair> {
        const payload = { userId: adminId, organizationId };

        const accessToken = createAccessToken(payload);
        const refreshToken = createRefreshToken(payload);
        const tokenHash = this._hashToken(refreshToken);

        const expiresAt = new Date(Date.now() + config.auth.jwt.refreshTtl * 1000);

        await this.repo.createRefreshToken({
            adminId,
            tokenHash,
            deviceInfo: device.userAgent,
            ipAddress: device.ipAddress,
            expiresAt,
        });

        return { accessToken, refreshToken };
    }


    private _hashToken(token: string): string {
        return crypto.createHash("sha256").update(token).digest('hex');
    }

}