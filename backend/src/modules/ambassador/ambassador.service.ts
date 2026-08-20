import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Ambassador, AmbassadorCampaignStatus, AmbassadorStatus, Prisma } from "@prisma/client";
import { AmbassadorRepository } from "./ambassador.repository";
import { AmbassadorCampaignRepository } from "../ambassador-campaign/ambassador-campaign.repository";
import { computeEnrollmentStats, computeLeaderboardGroups, findPrizeForRank, leaderboardScopeEquals } from "../ambassador-campaign/campaign-stats";
import { campaignStatsPaiseToRupees, leaderboardEntryPaiseToRupees, rewardConfigPaiseToRupees } from "../ambassador-campaign/reward-config-currency";
import { RewardConfig, ShareTemplates, LeaderboardScope, AvailableCampaignItem, MyCampaignItem, CampaignStats, CampaignStatsDetail, CampaignPhase, EnrollmentResult, LeaderboardEntryResult, PaginatedResult } from "../ambassador-campaign/ambassador-campaign.types";
import { OrganizationRepository } from "../organization/organization.repository";
import { EmailProvider } from "../../providers/email.provider";
import { FileStorageProvider } from "../../providers/storage.provider";
import { getActiveAmbassadorTypeByKey, getAllActiveAmbassadorTypes, getEnabledAmbassadorTypes, AmbassadorTypeDefinition, ApplicationFieldDef } from "../../common/ambassador-types";
import { redis } from "../../config/redis";
import { config } from "../../config";
import { generateotp, hashOtp, compareOtp } from "../../utils/otp";
import { MessageTemplate } from "../../types/message-template.enum";
import logger from "../../config/logger";
import {
    AmbassadorApplicationExistsError,
    BadRequestError,
    ConflictError,
    InvalidApplicationDataError,
    NotFoundError,
} from "../../error/http-errors";
import {
    SignupStartDTO,
    SignupCompleteDTO,
    AmbassadorResult,
    RequestUploadUrlDTO,
    UploadUrlResult,
} from "./ambassador.types";
import { UpdateProfileInput, UpdateProofInput } from "./ambassador.validator";

/** Pending-signup state, kept in Redis between signupStart and signupComplete — there is
 *  deliberately no half-created Ambassador row while someone is mid-signup (a person who
 *  never finishes step 2 just leaves no trace once this key expires). */
function ambassadorSignupKey(email: string): string {
    return `auth:ambassador:signup:${email.toLowerCase()}`;
}

/** Login OTP for an *existing* ambassador — separate key space from signup so a login
 *  attempt can never be confused with (or reuse) a pending signup's OTP. */
function ambassadorLoginOtpKey(email: string): string {
    return `auth:ambassador:otp:${email.toLowerCase()}`;
}

export class AmbassadorService {
    constructor(
        private readonly ambassadorRepo: AmbassadorRepository,
        private readonly campaignRepo: AmbassadorCampaignRepository,
        private readonly organizationRepo: OrganizationRepository,
        private readonly emailProvider: EmailProvider,
        private readonly storageProvider: FileStorageProvider,
    ) { }

    // ─── Public catalog + upload ─────────────────────────────────────────────────

    /** Platform-wide — every active type, used at signup before any org relationship exists. */
    async getPlatformTypes(): Promise<AmbassadorTypeDefinition[]> {
        return getAllActiveAmbassadorTypes();
    }

    /** Org-scoped — only the types that org has enabled, used by org-admin campaign config
     *  screens (the ambassadorTypesAllowed picker) to show a relevant, filtered list. */
    async getTypes(organizationId: string): Promise<AmbassadorTypeDefinition[]> {
        return getEnabledAmbassadorTypes(organizationId);
    }

    async getUploadUrl(dto: RequestUploadUrlDTO): Promise<UploadUrlResult> {
        // "signup" is a fixed segment, not an org slug — validateFolder requires a 3-part
        // path, and there's no organization in the picture yet at this point in the flow.
        const folder = `ambassador-proof/signup/${crypto.randomUUID()}`;
        return this.storageProvider.getPresignedPutUrl({
            filename: dto.filename,
            folder,
            mimeType: dto.mimeType,
            expiresInSeconds: 300,
        });
    }

    // ─── Signup (2-step, §platform identity) ────────────────────────────────────

    async signupStart(dto: SignupStartDTO): Promise<void> {
        const existing = await this.ambassadorRepo.findByEmail(dto.email);
        if (existing) {
            throw new AmbassadorApplicationExistsError(dto.email);
        }

        const otp = generateotp();
        const hash = hashOtp(otp);
        const key = ambassadorSignupKey(dto.email);

        await redis.hset(key, {
            firstName: dto.firstName,
            lastName: dto.lastName ?? "",
            phone: dto.phone ?? "",
            hash,
            attempts: "0",
            verified: "0",
        });
        await redis.expire(key, config.redis.ttl.otp);

        this.emailProvider
            .send(MessageTemplate.OTP_VERIFICATION_CODE, dto.email, { name: dto.firstName, otp })
            .catch((err) => {
                logger.error(`[ambassador] Failed to send signup OTP email to ${dto.email}: ${(err as Error).message}`);
            });
    }

    async signupVerifyOtp(email: string, otp: string): Promise<{ firstName: string; lastName: string | null; phone: string | null }> {
        const key = ambassadorSignupKey(email);
        const stored = await redis.hgetall(key);

        if (!stored.hash) {
            throw new BadRequestError("Signup session expired or was never started. Please start over.");
        }

        const attempts = parseInt(stored.attempts ?? "0", 10);
        if (attempts >= config.auth.otp.maxAttempts) {
            await redis.del(key);
            throw new BadRequestError("Too many incorrect attempts. Please start signup again.");
        }

        await redis.hincrby(key, "attempts", 1);

        if (!compareOtp(otp, stored.hash)) {
            throw new BadRequestError("Invalid OTP.");
        }

        // Refresh the TTL so there's a full window to complete step 2 (type + proof).
        await redis.hset(key, { verified: "1", attempts: "0" });
        await redis.expire(key, config.redis.ttl.otp);

        return {
            firstName: stored.firstName as string,
            lastName: stored.lastName ? stored.lastName : null,
            phone: stored.phone ? stored.phone : null,
        };
    }

    async signupComplete(dto: SignupCompleteDTO): Promise<{ token: string; expiresIn: number }> {
        const key = ambassadorSignupKey(dto.email);
        const stored = await redis.hgetall(key);

        if (!stored.hash || stored.verified !== "1") {
            throw new BadRequestError("Please verify your email before completing signup.");
        }

        const type = await getActiveAmbassadorTypeByKey(dto.ambassadorType);
        if (!type) {
            throw new BadRequestError(`Ambassador type "${dto.ambassadorType}" is not available.`);
        }

        const violations = this._validateApplicationData(type.applicationFields, dto.applicationData);
        if (violations.length > 0) {
            throw new InvalidApplicationDataError(violations);
        }

        // Race guard — e.g. two signup/complete calls for the same email in flight.
        const existing = await this.ambassadorRepo.findByEmail(dto.email);
        if (existing) {
            throw new AmbassadorApplicationExistsError(dto.email);
        }

        const ambassador = await this.ambassadorRepo.create({
            email: dto.email,
            phone: stored.phone ? stored.phone : null,
            firstName: stored.firstName as string,
            lastName: stored.lastName ? stored.lastName : null,
            ambassadorType: dto.ambassadorType,
            applicationData: dto.applicationData,
            proofStorageKey: dto.proofStorageKey,
            proofUrl: dto.proofUrl,
        });

        await redis.del(key);

        const token = jwt.sign(
            { ambassadorId: ambassador.id },
            config.auth.jwt.accessSecret,
            { expiresIn: config.auth.jwt.accessTtl },
        );

        return { token, expiresIn: config.auth.jwt.accessTtl };
    }

    private _validateApplicationData(
        fields: ApplicationFieldDef[],
        data: Record<string, unknown>,
    ): { field: string; issue: string }[] {
        const violations: { field: string; issue: string }[] = [];

        for (const field of fields) {
            const value = data?.[field.key];
            const isEmpty = value === undefined || value === null || value === "";

            if (field.required && isEmpty) {
                violations.push({ field: field.key, issue: `${field.label} is required` });
                continue;
            }
            if (!isEmpty && field.type === "SELECT" && field.options && !field.options.includes(String(value))) {
                violations.push({ field: field.key, issue: `${field.label} must be one of: ${field.options.join(", ")}` });
            }
        }

        return violations;
    }

    // ─── Login (returning ambassador) ───────────────────────────────────────────

    async requestOtp(email: string): Promise<void> {
        const ambassador = await this.ambassadorRepo.findByEmail(email);
        if (!ambassador) {
            throw new NotFoundError("No ambassador account found for this email. Please sign up first.");
        }

        const otp = generateotp();
        const hash = hashOtp(otp);
        const key = ambassadorLoginOtpKey(email);

        await redis.hset(key, { hash, attempts: "0" });
        await redis.expire(key, config.redis.ttl.otp);

        this.emailProvider
            .send(MessageTemplate.OTP_VERIFICATION_CODE, email, { name: ambassador.firstName, otp })
            .catch((err) => {
                logger.error(`[ambassador] Failed to send OTP email to ${email}: ${(err as Error).message}`);
            });
    }

    async verifyOtp(email: string, otp: string): Promise<{ token: string; expiresIn: number }> {
        const key = ambassadorLoginOtpKey(email);
        const stored = await redis.hgetall(key);

        if (!stored.hash) {
            throw new BadRequestError("OTP has expired or was never requested. Please request a new one.");
        }

        const attempts = parseInt(stored.attempts ?? "0", 10);
        if (attempts >= config.auth.otp.maxAttempts) {
            await redis.del(key);
            throw new BadRequestError("Too many incorrect attempts. Please request a new OTP.");
        }

        await redis.hincrby(key, "attempts", 1);

        if (!compareOtp(otp, stored.hash)) {
            throw new BadRequestError("Invalid OTP.");
        }

        await redis.del(key);

        const ambassador = await this.ambassadorRepo.findByEmail(email);
        if (!ambassador) throw new NotFoundError("No ambassador account found for this email.");

        const token = jwt.sign(
            { ambassadorId: ambassador.id },
            config.auth.jwt.accessSecret,
            { expiresIn: config.auth.jwt.accessTtl },
        );

        return { token, expiresIn: config.auth.jwt.accessTtl };
    }

    async getMe(ambassadorId: string): Promise<AmbassadorResult> {
        const ambassador = await this.ambassadorRepo.findById(ambassadorId);
        if (!ambassador) throw new NotFoundError("Ambassador not found.");
        return this._toResult(ambassador);
    }

    async updateProfile(ambassadorId: string, dto: UpdateProfileInput): Promise<AmbassadorResult> {
        const ambassador = await this.ambassadorRepo.findById(ambassadorId);
        if (!ambassador) throw new NotFoundError("Ambassador not found.");
        const updated = await this.ambassadorRepo.update(ambassadorId, dto as any);
        return this._toResult(updated);
    }

    async getAuthenticatedUploadUrl(ambassadorId: string, dto: RequestUploadUrlDTO): Promise<UploadUrlResult> {
        const folder = `ambassador-proof/${ambassadorId}/${crypto.randomUUID()}`;
        return this.storageProvider.getPresignedPutUrl({
            filename: dto.filename,
            folder,
            mimeType: dto.mimeType,
            expiresInSeconds: 300,
        });
    }

    async updateProof(ambassadorId: string, dto: UpdateProofInput): Promise<AmbassadorResult> {
        const ambassador = await this.ambassadorRepo.findById(ambassadorId);
        if (!ambassador) throw new NotFoundError("Ambassador not found.");
        const updated = await this.ambassadorRepo.update(ambassadorId, dto);
        return this._toResult(updated);
    }

    // ─── Campaigns — cross-organization, mirrors how /contests isn't org-scoped ─

    async listAvailableCampaigns(
        ambassadorId: string,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<AvailableCampaignItem>> {
        const ambassador = await this.ambassadorRepo.findById(ambassadorId);
        if (!ambassador) throw new NotFoundError("Ambassador not found.");

        const joinedIds = await this.campaignRepo.findJoinedCampaignIds(ambassadorId);
        const skip = (page - 1) * limit;

        const { rows, total } = await this.campaignRepo.findActiveForType({
            ambassadorType: ambassador.ambassadorType,
            excludeCampaignIds: joinedIds,
            skip,
            take: limit,
        });

        // contestId/contest are guaranteed non-null here: findActiveForType only returns
        // LIVE campaigns, and a campaign can only reach LIVE via publishCampaign(), which
        // requires contestId to be set (PublishCampaignSchema).
        const data: AvailableCampaignItem[] = rows.map((c) => ({
            id: c.id,
            name: c.name,
            contestId: c.contestId as string,
            contestSlug: c.contest!.slug,
            contestTitle: c.contest!.title,
            ambassadorTypesAllowed: c.ambassadorTypesAllowed,
            organizationName: c.organization.name,
            organizationSlug: c.organization.slug,
        }));

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async listMyCampaigns(
        ambassadorId: string,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<MyCampaignItem>> {
        const skip = (page - 1) * limit;
        const { rows, total } = await this.campaignRepo.findEnrollmentsByAmbassadorGlobal({
            ambassadorId,
            skip,
            take: limit,
        });

        const data: MyCampaignItem[] = await Promise.all(
            rows.map(async (enrollment) => {
                const rewardConfig = enrollment.campaign.rewardConfig as unknown as RewardConfig;
                // Pending/rejected applications have no meaningful stats yet — skip the
                // (relatively expensive) computation and return a zeroed shape instead.
                const stats = enrollment.status === AmbassadorStatus.APPROVED
                    ? await computeEnrollmentStats(this.campaignRepo, enrollment.id, rewardConfig)
                    : this._emptyStats();

                return {
                    enrollmentId: enrollment.id,
                    campaignId: enrollment.campaignId,
                    name: enrollment.campaign.name,
                    contestId: enrollment.campaign.contestId as string,
                    contestSlug: enrollment.campaign.contest!.slug,
                    contestTitle: enrollment.campaign.contest!.title,
                    organizationName: enrollment.campaign.organization.name,
                    organizationSlug: enrollment.campaign.organization.slug,
                    referralCode: enrollment.referralCode,
                    status: enrollment.status,
                    campaignStatus: enrollment.campaign.status,
                    rejectionReason: enrollment.rejectionReason,
                    shareTemplates: enrollment.campaign.shareTemplates as unknown as ShareTemplates,
                    stats: campaignStatsPaiseToRupees({ ...stats, leaderboardRanks: [] }),
                };
            }),
        );

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    private _emptyStats(): CampaignStats {
        return {
            registrationCount: 0,
            currentTier: null,
            nextTier: null,
            progressToNextTier: null,
            accruedAmount: 0,
            speedBonus: null,
            leaderboardRanks: [],
        };
    }

    /** One-click apply — reuses the ambassador's already-verified global identity/proof.
     *  Creates a PENDING enrollment; that campaign's organization reviews it independently
     *  of any other campaign (from any other org) this ambassador has applied to. */
    async applyToCampaign(ambassadorId: string, campaignId: string): Promise<EnrollmentResult> {
        const ambassador = await this.ambassadorRepo.findById(ambassadorId);
        if (!ambassador) throw new NotFoundError("Ambassador not found.");

        const campaign = await this.campaignRepo.findByIdGlobal(campaignId);
        if (!campaign) throw new NotFoundError("Campaign not found.");
        if (campaign.status !== AmbassadorCampaignStatus.LIVE) {
            throw new BadRequestError("This campaign is not currently active.");
        }
        if (!campaign.ambassadorTypesAllowed.includes(ambassador.ambassadorType)) {
            throw new BadRequestError("This campaign is not open to your ambassador type.");
        }

        const existing = await this.campaignRepo.findEnrollment(campaignId, ambassadorId);
        if (existing) {
            // Idempotent-safe: a double-click returns the existing application rather than erroring.
            return this._toEnrollmentResult(existing);
        }

        let enrollment;
        for (let attempt = 0; attempt < 5; attempt++) {
            const referralCode = crypto.randomBytes(5).toString("hex").toUpperCase();
            try {
                enrollment = await this.campaignRepo.createEnrollment(campaignId, ambassadorId, referralCode);
                break;
            } catch (err: any) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                    continue; // referralCode collision — retry with a fresh code
                }
                throw err;
            }
        }
        if (!enrollment) throw new ConflictError("Could not generate a unique referral code. Please try again.");

        const organization = await this.organizationRepo.findById(campaign.organizationId);
        this.emailProvider
            .send(MessageTemplate.AMBASSADOR_APPLICATION_RECEIVED, ambassador.email, {
                name: ambassador.firstName,
                orgName: organization?.name ?? "the organization",
            })
            .catch((err) => {
                logger.error(`[ambassador] Failed to send application-received email: ${(err as Error).message}`);
            });

        return this._toEnrollmentResult(enrollment);
    }

    async getCampaignStats(ambassadorId: string, campaignId: string): Promise<CampaignStatsDetail> {
        const ambassador = await this.ambassadorRepo.findById(ambassadorId);
        if (!ambassador) throw new NotFoundError("Ambassador not found.");

        const enrollment = await this.campaignRepo.findEnrollment(campaignId, ambassadorId);
        if (!enrollment) throw new NotFoundError("You have not applied to this campaign.");
        if (enrollment.status !== AmbassadorStatus.APPROVED) {
            throw new BadRequestError(
                enrollment.status === AmbassadorStatus.PENDING
                    ? "Your application to this campaign is still under review."
                    : "Your application to this campaign was not approved.",
            );
        }

        const campaign = await this.campaignRepo.findByIdGlobal(campaignId);
        if (!campaign) throw new NotFoundError("Campaign not found.");

        const rewardConfig = campaign.rewardConfig as unknown as RewardConfig;
        const stats = await computeEnrollmentStats(this.campaignRepo, enrollment.id, rewardConfig);

        const leaderboardRanks = await Promise.all(
            (rewardConfig.leaderboardPrizes ?? []).map(async (cut) => {
                const groups = await computeLeaderboardGroups(this.campaignRepo, campaignId, cut.scope, cut.rankedBy);
                const rank = groups.findIndex((g) => g.ambassadorIds.includes(ambassadorId));
                return { scope: cut.scope, label: cut.label, rank: rank === -1 ? null : rank + 1 };
            }),
        );

        return {
            ...campaignStatsPaiseToRupees({ ...stats, leaderboardRanks: [] }),
            leaderboardRanks,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                contestId: campaign.contestId as string,
                contestSlug: campaign.contest!.slug,
                referralCode: enrollment.referralCode,
                ambassadorTypesAllowed: campaign.ambassadorTypesAllowed,
                shareTemplates: campaign.shareTemplates as unknown as ShareTemplates,
                status: campaign.status,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
                phases: campaign.phases as unknown as CampaignPhase[],
                milestoneTiers: rewardConfigPaiseToRupees(rewardConfig).milestoneTiers,
            },
        };
    }

    async getCampaignLeaderboard(
        campaignId: string,
        scope: LeaderboardScope,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<LeaderboardEntryResult>> {
        const campaign = await this.campaignRepo.findByIdGlobal(campaignId);
        if (!campaign) throw new NotFoundError("Campaign not found.");

        const rewardConfig = campaign.rewardConfig as unknown as RewardConfig;
        const cut = rewardConfig.leaderboardPrizes.find((c) => leaderboardScopeEquals(c.scope, scope));

        const groups = await computeLeaderboardGroups(this.campaignRepo, campaignId, scope, cut?.rankedBy);
        const total = groups.length;
        const skip = (page - 1) * limit;
        const page_ = groups.slice(skip, skip + limit);

        const data: LeaderboardEntryResult[] = page_.map((g, i) => {
            const rank = skip + i + 1;
            const entry: LeaderboardEntryResult = {
                rank,
                groupKey: g.groupKey,
                label: g.label,
                registrationCount: g.registrationCount,
                prize: cut ? findPrizeForRank(cut, rank) : null,
            };
            return leaderboardEntryPaiseToRupees(entry);
        });

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ─── helpers ─────────────────────────────────────────────────────────────────

    private _toResult(a: Ambassador): AmbassadorResult {
        return {
            id: a.id,
            email: a.email,
            phone: a.phone,
            firstName: a.firstName,
            lastName: a.lastName,
            ambassadorType: a.ambassadorType,
            applicationData: a.applicationData as Record<string, unknown>,
            proofUrl: a.proofUrl,
            createdAt: a.createdAt,
        };
    }

    private _toEnrollmentResult(e: { id: string; campaignId: string; ambassadorId: string; referralCode: string; status: AmbassadorStatus; createdAt: Date }): EnrollmentResult {
        return { id: e.id, campaignId: e.campaignId, ambassadorId: e.ambassadorId, referralCode: e.referralCode, status: e.status, createdAt: e.createdAt };
    }
}
