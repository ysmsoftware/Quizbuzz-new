import { Prisma } from "@prisma/client";
import { AmbassadorCampaignRepository } from "./ambassador-campaign.repository";
import { AmbassadorRepository } from "../ambassador/ambassador.repository";
import { OrganizationRepository } from "../organization/organization.repository";
import { EmailProvider } from "../../providers/email.provider";
import { FileStorageProvider } from "../../providers/storage.provider";
import { MessageTemplate } from "../../types/message-template.enum";
import { config } from "../../config";
import logger from "../../config/logger";
import { ConflictError, NotFoundError } from "../../error/http-errors";
import { computeEnrollmentStats, computeLeaderboardGroups, findPrizeForRank } from "./campaign-stats";
import { AmbassadorResult } from "../ambassador/ambassador.types";
import {
    ApplicationReportRow,
    CampaignListItem,
    CampaignResult,
    CreateCampaignDTO,
    DuplicateCampaignDTO,
    LeaderboardEntryResult,
    LeaderboardScope,
    ListApplicationsQueryDTO,
    ListCampaignsQueryDTO,
    ListReportQueryDTO,
    PaginatedResult,
    RewardConfig,
    ShareTemplates,
    UpdateCampaignDTO,
} from "./ambassador-campaign.types";

export class AmbassadorCampaignService {
    constructor(
        private readonly campaignRepo: AmbassadorCampaignRepository,
        private readonly ambassadorRepo: AmbassadorRepository,
        private readonly organizationRepo: OrganizationRepository,
        private readonly emailProvider: EmailProvider,
        private readonly storageProvider: FileStorageProvider,
    ) { }

    // ─── Applications review (§5.3) ─────────────────────────────────────────────

    async listApplications(
        organizationId: string,
        query: ListApplicationsQueryDTO,
    ): Promise<PaginatedResult<AmbassadorResult>> {
        const skip = (query.page - 1) * query.limit;
        const { rows, total } = await this.ambassadorRepo.findAll({
            organizationId,
            statuses: query.statuses && query.statuses.length > 0 ? query.statuses : ["PENDING"],
            skip,
            take: query.limit,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
        });

        return {
            data: rows.map((a) => this._toAmbassadorResult(a)),
            total,
            page: query.page,
            limit: query.limit,
            totalPages: Math.ceil(total / query.limit),
        };
    }

    async getApplication(organizationId: string, id: string): Promise<AmbassadorResult & { proofDownloadUrl: string }> {
        const ambassador = await this.ambassadorRepo.findById(id, organizationId);
        if (!ambassador) throw new NotFoundError("Ambassador application not found.");

        const { url } = await this.storageProvider.getPresignedGetUrl({
            storageKey: ambassador.proofStorageKey,
            expiresInSeconds: 3600,
        });

        return { ...this._toAmbassadorResult(ambassador), proofDownloadUrl: url };
    }

    async approveApplication(organizationId: string, id: string, reviewedById: string): Promise<AmbassadorResult> {
        const ambassador = await this.ambassadorRepo.findById(id, organizationId);
        if (!ambassador) throw new NotFoundError("Ambassador application not found.");

        const updated = await this.ambassadorRepo.updateStatus(id, organizationId, {
            status: "APPROVED",
            reviewedById,
            rejectionReason: null,
        });

        const organization = await this.organizationRepo.findById(organizationId);
        this.emailProvider
            .send(MessageTemplate.AMBASSADOR_APPLICATION_APPROVED, updated.email, {
                name: updated.firstName,
                orgName: organization?.name ?? "the organization",
                link: `${config.app.frontendUrl}/ambassador/dashboard`,
            })
            .catch((err) => logger.error(`[ambassador-campaign] Failed to send approval email: ${(err as Error).message}`));

        return this._toAmbassadorResult(updated);
    }

    async rejectApplication(organizationId: string, id: string, reviewedById: string, reason: string): Promise<AmbassadorResult> {
        const ambassador = await this.ambassadorRepo.findById(id, organizationId);
        if (!ambassador) throw new NotFoundError("Ambassador application not found.");

        const updated = await this.ambassadorRepo.updateStatus(id, organizationId, {
            status: "REJECTED",
            reviewedById,
            rejectionReason: reason,
        });

        const organization = await this.organizationRepo.findById(organizationId);
        this.emailProvider
            .send(MessageTemplate.AMBASSADOR_APPLICATION_REJECTED, updated.email, {
                name: updated.firstName,
                orgName: organization?.name ?? "the organization",
                reason,
            })
            .catch((err) => logger.error(`[ambassador-campaign] Failed to send rejection email: ${(err as Error).message}`));

        return this._toAmbassadorResult(updated);
    }

    // ─── Campaign CRUD (§5.3) ────────────────────────────────────────────────────

    async createCampaign(organizationId: string, createdById: string, dto: CreateCampaignDTO): Promise<CampaignResult> {
        const existing = await this.campaignRepo.findByContestId(dto.contestId, organizationId);
        if (existing) {
            throw new ConflictError("This contest already has an active ambassador campaign.");
        }

        const campaign = await this.campaignRepo.create({
            organizationId,
            contestId: dto.contestId,
            name: dto.name,
            ambassadorTypesAllowed: dto.ambassadorTypesAllowed,
            rewardConfig: dto.rewardConfig as unknown as Prisma.InputJsonValue,
            shareTemplates: (dto.shareTemplates ?? {}) as unknown as Prisma.InputJsonValue,
            createdById,
        });

        const full = await this.campaignRepo.findById(campaign.id, organizationId);
        return this._toCampaignResult(full!);
    }

    async getCampaign(organizationId: string, id: string): Promise<CampaignResult> {
        const campaign = await this.campaignRepo.findById(id, organizationId);
        if (!campaign) throw new NotFoundError("Campaign not found.");
        return this._toCampaignResult(campaign);
    }

    async listCampaigns(organizationId: string, query: ListCampaignsQueryDTO): Promise<PaginatedResult<CampaignListItem>> {
        const skip = (query.page - 1) * query.limit;
        const { rows, total } = await this.campaignRepo.findAll({
            organizationId,
            status: query.status,
            skip,
            take: query.limit,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
        });

        const data: CampaignListItem[] = rows.map((c) => ({
            id: c.id,
            name: c.name,
            contestId: c.contestId,
            contestTitle: c.contest.title,
            status: c.status,
            ambassadorTypesAllowed: c.ambassadorTypesAllowed,
            enrollmentCount: c._count.enrollments,
            createdAt: c.createdAt,
        }));

        return { data, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
    }

    async updateCampaign(organizationId: string, id: string, dto: UpdateCampaignDTO): Promise<CampaignResult> {
        const existing = await this.campaignRepo.findById(id, organizationId);
        if (!existing) throw new NotFoundError("Campaign not found.");

        await this.campaignRepo.updateById(id, organizationId, {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.ambassadorTypesAllowed !== undefined && { ambassadorTypesAllowed: dto.ambassadorTypesAllowed }),
            ...(dto.rewardConfig !== undefined && { rewardConfig: dto.rewardConfig as unknown as Prisma.InputJsonValue }),
            ...(dto.shareTemplates !== undefined && { shareTemplates: dto.shareTemplates as unknown as Prisma.InputJsonValue }),
            ...(dto.status !== undefined && { status: dto.status }),
        });

        const full = await this.campaignRepo.findById(id, organizationId);
        return this._toCampaignResult(full!);
    }

    async duplicateCampaign(organizationId: string, createdById: string, id: string, dto: DuplicateCampaignDTO): Promise<CampaignResult> {
        const source = await this.campaignRepo.findById(id, organizationId);
        if (!source) throw new NotFoundError("Campaign not found.");

        const existing = await this.campaignRepo.findByContestId(dto.contestId, organizationId);
        if (existing) {
            throw new ConflictError("This contest already has an active ambassador campaign.");
        }

        const campaign = await this.campaignRepo.create({
            organizationId,
            contestId: dto.contestId,
            name: source.name,
            ambassadorTypesAllowed: source.ambassadorTypesAllowed,
            rewardConfig: source.rewardConfig as Prisma.InputJsonValue,
            shareTemplates: source.shareTemplates as Prisma.InputJsonValue,
            sourceCampaignId: source.id,
            createdById,
        });

        const full = await this.campaignRepo.findById(campaign.id, organizationId);
        return this._toCampaignResult(full!);
    }

    // ─── Report + leaderboard (§5.3, §6.3) ──────────────────────────────────────

    async getCampaignReport(organizationId: string, campaignId: string, query: ListReportQueryDTO): Promise<PaginatedResult<ApplicationReportRow>> {
        const campaign = await this.campaignRepo.findById(campaignId, organizationId);
        if (!campaign) throw new NotFoundError("Campaign not found.");

        const rows = await this._buildReportRows(campaign.id, campaign.rewardConfig as unknown as RewardConfig);

        rows.sort((a, b) => {
            const dir = query.sortOrder === "asc" ? 1 : -1;
            if (query.sortBy === "registrationCount") return (a.registrationCount - b.registrationCount) * dir;
            return (a.createdAt.getTime() - b.createdAt.getTime()) * dir;
        });

        const total = rows.length;
        const skip = (query.page - 1) * query.limit;
        const data = rows.slice(skip, skip + query.limit);

        return { data, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
    }

    /** ponytail: synchronous in-memory CSV — pilot-scale row counts, no BullMQ export worker needed. Upgrade when campaigns regularly exceed a few thousand ambassadors. */
    async exportCampaignReportCsv(organizationId: string, campaignId: string): Promise<string> {
        const campaign = await this.campaignRepo.findById(campaignId, organizationId);
        if (!campaign) throw new NotFoundError("Campaign not found.");

        const rows = await this._buildReportRows(campaign.id, campaign.rewardConfig as unknown as RewardConfig);

        const header = ["Ambassador", "Email", "Registrations", "Current Tier", "Amount Owed (paise)"];
        const lines = rows.map((r) =>
            [
                `${r.firstName} ${r.lastName ?? ""}`.trim(),
                r.email,
                String(r.registrationCount),
                r.currentTierLabel ?? "",
                String(r.accruedAmount),
            ]
                .map((cell) => `"${cell.replace(/"/g, '""')}"`)
                .join(","),
        );

        return [header.join(","), ...lines].join("\n");
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
        const paged = groups.slice(skip, skip + limit);

        const data: LeaderboardEntryResult[] = paged.map((g, i) => {
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

    private async _buildReportRows(campaignId: string, rewardConfig: RewardConfig): Promise<ApplicationReportRow[]> {
        const enrollments = await this.campaignRepo.listEnrollmentsForCampaign(campaignId);

        return Promise.all(
            enrollments.map(async (enrollment) => {
                const stats = await computeEnrollmentStats(this.campaignRepo, enrollment.id, rewardConfig);
                return {
                    ambassadorId: enrollment.ambassadorId,
                    firstName: enrollment.ambassador.firstName,
                    lastName: enrollment.ambassador.lastName,
                    email: enrollment.ambassador.email,
                    registrationCount: stats.registrationCount,
                    currentTierLabel: stats.currentTier?.label ?? stats.currentTier?.goodie?.label ?? (stats.currentTier ? `${stats.currentTier.minRegistrations}+` : null),
                    accruedAmount: stats.accruedAmount,
                    createdAt: enrollment.createdAt,
                };
            }),
        );
    }

    private _toAmbassadorResult(a: {
        id: string; organizationId: string; email: string; phone: string | null; firstName: string; lastName: string | null;
        ambassadorType: string; applicationData: unknown; status: any; proofUrl: string; appliedAt: Date; reviewedAt: Date | null; rejectionReason: string | null;
    }): AmbassadorResult {
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

    private _toCampaignResult(c: {
        id: string; organizationId: string; contestId: string; name: string; ambassadorTypesAllowed: string[];
        rewardConfig: unknown; shareTemplates: unknown; sourceCampaignId: string | null; status: any; createdById: string;
        createdAt: Date; updatedAt: Date;
    }): CampaignResult {
        return {
            id: c.id,
            organizationId: c.organizationId,
            contestId: c.contestId,
            name: c.name,
            ambassadorTypesAllowed: c.ambassadorTypesAllowed,
            rewardConfig: c.rewardConfig as unknown as RewardConfig,
            shareTemplates: c.shareTemplates as unknown as ShareTemplates,
            sourceCampaignId: c.sourceCampaignId,
            status: c.status,
            createdById: c.createdById,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        };
    }
}
