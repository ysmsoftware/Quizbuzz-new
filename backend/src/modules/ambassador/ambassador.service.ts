import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Ambassador, AmbassadorCampaignStatus, Prisma } from "@prisma/client";
import { AmbassadorRepository } from "./ambassador.repository";
import { AmbassadorCampaignRepository } from "../ambassador-campaign/ambassador-campaign.repository";
import { computeEnrollmentStats, computeLeaderboardGroups, findPrizeForRank } from "../ambassador-campaign/campaign-stats";
import { RewardConfig, ShareTemplates, LeaderboardScope, AvailableCampaignItem, MyCampaignItem, CampaignStats, CampaignStatsDetail, EnrollmentResult, LeaderboardEntryResult, PaginatedResult } from "../ambassador-campaign/ambassador-campaign.types";
import { OrganizationRepository } from "../organization/organization.repository";
import { EmailProvider } from "../../providers/email.provider";
import { FileStorageProvider } from "../../providers/storage.provider";
import { getAmbassadorTypeByKey, getEnabledAmbassadorTypes, AmbassadorTypeDefinition, ApplicationFieldDef } from "../../common/ambassador-types";
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
import { ApplyAmbassadorDTO, AmbassadorResult, RequestUploadUrlDTO, UploadUrlResult } from "./ambassador.types";

function ambassadorOtpKey(email: string, organizationId: string): string {
    return `auth:ambassador:otp:${organizationId}:${email.toLowerCase()}`;
}

export class AmbassadorService {
    constructor(
        private readonly ambassadorRepo: AmbassadorRepository,
        private readonly campaignRepo: AmbassadorCampaignRepository,
        private readonly organizationRepo: OrganizationRepository,
        private readonly emailProvider: EmailProvider,
        private readonly storageProvider: FileStorageProvider,
    ) { }

    // ─── Public catalog + upload + apply (§5.1, §6.1) ───────────────────────────

    async getTypes(organizationId: string): Promise<AmbassadorTypeDefinition[]> {
        return getEnabledAmbassadorTypes(organizationId);
    }

    async getUploadUrl(dto: RequestUploadUrlDTO): Promise<UploadUrlResult> {
        const organization = await this.organizationRepo.findById(dto.organizationId);
        if (!organization) throw new NotFoundError("Organization not found.");

        // ponytail: the Ambassador row doesn't exist yet at upload time, so we
        // can't use its id as the folder's 3rd segment the way the guide's
        // sketch assumes. A random id keeps the same 3-segment shape
        // validateFolder enforces; proofStorageKey is just carried through
        // verbatim onto the Ambassador row created by /apply right after.
        const tempId = crypto.randomUUID();
        const folder = `ambassador-proof/${organization.slug}/${tempId}`;

        return this.storageProvider.getPresignedPutUrl({
            filename: dto.filename,
            folder,
            mimeType: dto.mimeType,
            expiresInSeconds: 300,
        });
    }

    async apply(dto: ApplyAmbassadorDTO): Promise<AmbassadorResult> {
        const type = await getAmbassadorTypeByKey(dto.ambassadorType, dto.organizationId);
        if (!type) {
            throw new BadRequestError(`Ambassador type "${dto.ambassadorType}" is not available for this organization.`);
        }

        const violations = this._validateApplicationData(type.applicationFields, dto.applicationData);
        if (violations.length > 0) {
            throw new InvalidApplicationDataError(violations);
        }

        const existing = await this.ambassadorRepo.findByEmail(dto.email, dto.organizationId);
        if (existing) {
            throw new AmbassadorApplicationExistsError(dto.email);
        }

        const ambassador = await this.ambassadorRepo.create({
            organizationId: dto.organizationId,
            email: dto.email,
            phone: dto.phone ?? null,
            firstName: dto.firstName,
            lastName: dto.lastName ?? null,
            ambassadorType: dto.ambassadorType,
            applicationData: dto.applicationData,
            proofStorageKey: dto.proofStorageKey,
            proofUrl: dto.proofUrl,
        });

        const organization = await this.organizationRepo.findById(dto.organizationId);
        this.emailProvider
            .send(MessageTemplate.AMBASSADOR_APPLICATION_RECEIVED, dto.email, {
                name: dto.firstName,
                orgName: organization?.name ?? "the organization",
            })
            .catch((err) => {
                logger.error(`[ambassador] Failed to send application-received email: ${(err as Error).message}`);
            });

        return this._toResult(ambassador);
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

    // ─── Auth (§4) ───────────────────────────────────────────────────────────────

    async requestOtp(email: string, organizationId: string): Promise<void> {
        const ambassador = await this.ambassadorRepo.findByEmail(email, organizationId);
        if (!ambassador) {
            // Don't reveal whether an email has applied before to an unauthenticated caller.
            throw new NotFoundError("No ambassador application found for this email.");
        }

        const otp = generateotp();
        const hash = hashOtp(otp);
        const key = ambassadorOtpKey(email, organizationId);

        await redis.hset(key, { hash, attempts: "0" });
        await redis.expire(key, config.redis.ttl.otp);

        this.emailProvider
            .send(MessageTemplate.OTP_VERIFICATION_CODE, email, { name: ambassador.firstName, otp })
            .catch((err) => {
                logger.error(`[ambassador] Failed to send OTP email to ${email}: ${(err as Error).message}`);
            });
    }

    async verifyOtp(
        email: string,
        organizationId: string,
        otp: string,
    ): Promise<{ token: string; expiresIn: number; status: Ambassador["status"] }> {
        const key = ambassadorOtpKey(email, organizationId);
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

        const ambassador = await this.ambassadorRepo.findByEmail(email, organizationId);
        if (!ambassador) throw new NotFoundError("No ambassador application found for this email.");

        const token = jwt.sign(
            { ambassadorId: ambassador.id, organizationId },
            config.auth.jwt.accessSecret,
            { expiresIn: config.auth.jwt.accessTtl },
        );

        return { token, expiresIn: config.auth.jwt.accessTtl, status: ambassador.status };
    }

    async getMe(ambassadorId: string, organizationId: string): Promise<AmbassadorResult> {
        const ambassador = await this.ambassadorRepo.findById(ambassadorId, organizationId);
        if (!ambassador) throw new NotFoundError("Ambassador not found.");
        return this._toResult(ambassador);
    }

    // ─── Campaigns (§5.2) ────────────────────────────────────────────────────────

    async listAvailableCampaigns(
        ambassadorId: string,
        organizationId: string,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<AvailableCampaignItem>> {
        const ambassador = await this.ambassadorRepo.findById(ambassadorId, organizationId);
        if (!ambassador) throw new NotFoundError("Ambassador not found.");

        const joinedIds = await this.campaignRepo.findJoinedCampaignIds(ambassadorId);
        const skip = (page - 1) * limit;

        const { rows, total } = await this.campaignRepo.findActiveForOrgAndType({
            organizationId,
            ambassadorType: ambassador.ambassadorType,
            excludeCampaignIds: joinedIds,
            skip,
            take: limit,
        });

        const data: AvailableCampaignItem[] = rows.map((c) => ({
            id: c.id,
            name: c.name,
            contestId: c.contestId,
            contestSlug: c.contest.slug,
            contestTitle: c.contest.title,
            ambassadorTypesAllowed: c.ambassadorTypesAllowed,
        }));

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async listMyCampaigns(
        ambassadorId: string,
        organizationId: string,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<MyCampaignItem>> {
        const skip = (page - 1) * limit;
        const { rows, total } = await this.campaignRepo.findEnrollmentsByAmbassador({
            ambassadorId,
            organizationId,
            skip,
            take: limit,
        });

        const data: MyCampaignItem[] = await Promise.all(
            rows.map(async (enrollment) => {
                const rewardConfig = enrollment.campaign.rewardConfig as unknown as RewardConfig;
                const stats = await computeEnrollmentStats(this.campaignRepo, enrollment.id, rewardConfig);

                return {
                    enrollmentId: enrollment.id,
                    campaignId: enrollment.campaignId,
                    name: enrollment.campaign.name,
                    contestId: enrollment.campaign.contestId,
                    contestSlug: enrollment.campaign.contest.slug,
                    contestTitle: enrollment.campaign.contest.title,
                    referralCode: enrollment.referralCode,
                    shareTemplates: enrollment.campaign.shareTemplates as unknown as ShareTemplates,
                    stats: { ...stats, leaderboardRanks: [] },
                };
            }),
        );

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async joinCampaign(ambassadorId: string, organizationId: string, campaignId: string): Promise<EnrollmentResult> {
        const ambassador = await this.ambassadorRepo.findById(ambassadorId, organizationId);
        if (!ambassador) throw new NotFoundError("Ambassador not found.");
        if (ambassador.status !== "APPROVED") {
            throw new BadRequestError("Only approved ambassadors can join campaigns.");
        }

        const campaign = await this.campaignRepo.findById(campaignId, organizationId);
        if (!campaign) throw new NotFoundError("Campaign not found.");
        if (campaign.status !== AmbassadorCampaignStatus.ACTIVE) {
            throw new BadRequestError("This campaign is not currently active.");
        }
        if (!campaign.ambassadorTypesAllowed.includes(ambassador.ambassadorType)) {
            throw new BadRequestError("This campaign is not open to your ambassador type.");
        }

        const existing = await this.campaignRepo.findEnrollment(campaignId, ambassadorId);
        if (existing) {
            // Idempotent-safe: a double-click returns the existing enrollment rather than erroring.
            return this._toEnrollmentResult(existing);
        }

        for (let attempt = 0; attempt < 5; attempt++) {
            const referralCode = crypto.randomBytes(5).toString("hex").toUpperCase();
            try {
                const enrollment = await this.campaignRepo.createEnrollment(campaignId, ambassadorId, referralCode);
                return this._toEnrollmentResult(enrollment);
            } catch (err: any) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                    continue; // referralCode collision — retry with a fresh code
                }
                throw err;
            }
        }

        throw new ConflictError("Could not generate a unique referral code. Please try again.");
    }

    async getCampaignStats(ambassadorId: string, organizationId: string, campaignId: string): Promise<CampaignStatsDetail> {
        const ambassador = await this.ambassadorRepo.findById(ambassadorId, organizationId);
        if (!ambassador) throw new NotFoundError("Ambassador not found.");

        const enrollment = await this.campaignRepo.findEnrollment(campaignId, ambassadorId);
        if (!enrollment) throw new NotFoundError("You have not joined this campaign.");

        const campaign = await this.campaignRepo.findById(campaignId, organizationId);
        if (!campaign) throw new NotFoundError("Campaign not found.");

        const rewardConfig = campaign.rewardConfig as unknown as RewardConfig;
        const stats = await computeEnrollmentStats(this.campaignRepo, enrollment.id, rewardConfig);

        const leaderboardRanks = await Promise.all(
            (rewardConfig.leaderboardPrizes ?? []).map(async (cut) => {
                const groups = await computeLeaderboardGroups(this.campaignRepo, campaignId, cut.scope);
                const rank = groups.findIndex((g) => g.ambassadorIds.includes(ambassadorId));
                return { scope: cut.scope, label: cut.label, rank: rank === -1 ? null : rank + 1 };
            }),
        );

        return {
            ...stats,
            leaderboardRanks,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                contestId: campaign.contestId,
                contestSlug: campaign.contest.slug,
                referralCode: enrollment.referralCode,
                ambassadorTypesAllowed: campaign.ambassadorTypesAllowed,
                shareTemplates: campaign.shareTemplates as unknown as ShareTemplates,
            },
        };
    }

    async getCampaignLeaderboard(
        organizationId: string,
        campaignId: string,
        scope: LeaderboardScope,
        page: number,
        limit: number,
    ): Promise<PaginatedResult<LeaderboardEntryResult>> {
        const campaign = await this.campaignRepo.findById(campaignId, organizationId);
        if (!campaign) throw new NotFoundError("Campaign not found.");

        const rewardConfig = campaign.rewardConfig as unknown as RewardConfig;
        const cut = rewardConfig.leaderboardPrizes.find((c) => c.scope === scope);

        const groups = await computeLeaderboardGroups(this.campaignRepo, campaignId, scope);
        const total = groups.length;
        const skip = (page - 1) * limit;
        const page_ = groups.slice(skip, skip + limit);

        const data: LeaderboardEntryResult[] = page_.map((g, i) => {
            const rank = skip + i + 1;
            return {
                rank,
                groupKey: g.groupKey,
                label: g.label,
                registrationCount: g.registrationCount,
                prize: cut ? findPrizeForRank(cut, rank) : null,
            };
        });

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ─── helpers ─────────────────────────────────────────────────────────────────

    private _toResult(a: Ambassador): AmbassadorResult {
        return {
            id: a.id,
            organizationId: a.organizationId,
            email: a.email,
            phone: a.phone,
            firstName: a.firstName,
            lastName: a.lastName,
            ambassadorType: a.ambassadorType,
            applicationData: a.applicationData as Record<string, unknown>,
            status: a.status,
            proofUrl: a.proofUrl,
            appliedAt: a.appliedAt,
            reviewedAt: a.reviewedAt,
            rejectionReason: a.rejectionReason,
        };
    }

    private _toEnrollmentResult(e: { id: string; campaignId: string; ambassadorId: string; referralCode: string; createdAt: Date }): EnrollmentResult {
        return { id: e.id, campaignId: e.campaignId, ambassadorId: e.ambassadorId, referralCode: e.referralCode, createdAt: e.createdAt };
    }
}
