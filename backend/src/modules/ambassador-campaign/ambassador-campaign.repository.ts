import { Ambassador, AmbassadorCampaign, AmbassadorCampaignEnrollment, AmbassadorCampaignStatus, AmbassadorCampaignTemplate, AmbassadorGroup, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";

export interface FindCampaignsFilter {
    organizationId: string;
    statuses?: AmbassadorCampaignStatus[] | undefined;
    ambassadorType?: string | undefined;
    q?: string | undefined;
    skip: number;
    take: number;
    sortBy: "createdAt" | "name" | "startDate" | "status";
    sortOrder: "asc" | "desc";
}

export interface FindTemplatesFilter {
    organizationId: string;
    skip: number;
    take: number;
    sortBy: "createdAt" | "name";
    sortOrder: "asc" | "desc";
}

export type CampaignWithContestTitle = AmbassadorCampaign & { contest: { title: string; slug: string } | null; _count: { enrollments: number } };
export type EnrollmentWithCampaign = AmbassadorCampaignEnrollment & {
    campaign: AmbassadorCampaign & { contest: { title: string; slug: string } | null };
};
export type EnrollmentWithAmbassador = AmbassadorCampaignEnrollment & { ambassador: Ambassador };

export class AmbassadorCampaignRepository {

    // Campaign CRUD (org-admin)

    async create(data: {
        organizationId: string;
        contestId?: string | null;
        name: string;
        ambassadorTypesAllowed: string[];
        rewardConfig: Prisma.InputJsonValue;
        shareTemplates: Prisma.InputJsonValue;
        sourceCampaignId?: string | null;
        sourceTemplateId?: string | null;
        status?: AmbassadorCampaignStatus;
        createdById: string;
        startDate?: Date | null;
        endDate?: Date | null;
        phases?: Prisma.InputJsonValue;
        phaseTemplate?: Prisma.InputJsonValue;
    }): Promise<AmbassadorCampaign> {
        return prisma.ambassadorCampaign.create({ data });
    }

    async findById(id: string, organizationId: string): Promise<CampaignWithContestTitle | null> {
        return prisma.ambassadorCampaign.findFirst({
            where: { id, organizationId },
            include: { contest: { select: { title: true, slug: true } }, _count: { select: { enrollments: true } } },
        });
    }

    async findByContestId(contestId: string, organizationId: string): Promise<AmbassadorCampaign | null> {
        return prisma.ambassadorCampaign.findFirst({ where: { contestId, organizationId } });
    }

    async findAll(filter: FindCampaignsFilter): Promise<{ rows: CampaignWithContestTitle[]; total: number }> {
        const where: Prisma.AmbassadorCampaignWhereInput = {
            organizationId: filter.organizationId,
            ...(filter.statuses?.length ? { status: { in: filter.statuses } } : {}),
            ...(filter.ambassadorType ? { ambassadorTypesAllowed: { has: filter.ambassadorType } } : {}),
            ...(filter.q ? { name: { contains: filter.q, mode: "insensitive" } } : {}),
        };

        const [rows, total] = await prisma.$transaction([
            prisma.ambassadorCampaign.findMany({
                where,
                skip: filter.skip,
                take: filter.take,
                orderBy: { [filter.sortBy]: filter.sortOrder },
                include: { contest: { select: { title: true, slug: true } }, _count: { select: { enrollments: true } } },
            }),
            prisma.ambassadorCampaign.count({ where }),
        ]);

        return { rows, total };
    }

    async updateById(
        id: string,
        organizationId: string,
        data: Partial<{
            name: string;
            contestId: string | null;
            ambassadorTypesAllowed: string[];
            rewardConfig: Prisma.InputJsonValue;
            shareTemplates: Prisma.InputJsonValue;
            status: AmbassadorCampaignStatus;
            wizardStep: number;
            publishedAt: Date | null;
            startDate: Date | null;
            endDate: Date | null;
            phases: Prisma.InputJsonValue;
            phaseTemplate: Prisma.InputJsonValue;
        }>,
    ): Promise<AmbassadorCampaign> {
        return prisma.ambassadorCampaign.update({ where: { id, organizationId }, data });
    }

    // Ambassador-facing reads

    async findActiveForOrgAndType(params: {
        organizationId: string;
        ambassadorType: string;
        excludeCampaignIds: string[];
        skip: number;
        take: number;
    }): Promise<{ rows: CampaignWithContestTitle[]; total: number }> {
        const where: Prisma.AmbassadorCampaignWhereInput = {
            organizationId: params.organizationId,
            status: AmbassadorCampaignStatus.LIVE,
            ambassadorTypesAllowed: { has: params.ambassadorType },
            ...(params.excludeCampaignIds.length ? { id: { notIn: params.excludeCampaignIds } } : {}),
        };

        const [rows, total] = await prisma.$transaction([
            prisma.ambassadorCampaign.findMany({
                where,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: "desc" },
                include: { contest: { select: { title: true, slug: true } }, _count: { select: { enrollments: true } } },
            }),
            prisma.ambassadorCampaign.count({ where }),
        ]);

        return { rows, total };
    }

    async findJoinedCampaignIds(ambassadorId: string): Promise<string[]> {
        const rows = await prisma.ambassadorCampaignEnrollment.findMany({
            where: { ambassadorId },
            select: { campaignId: true },
        });
        return rows.map((r) => r.campaignId);
    }

    async findEnrollmentsByAmbassador(params: {
        ambassadorId: string;
        organizationId: string;
        skip: number;
        take: number;
    }): Promise<{ rows: EnrollmentWithCampaign[]; total: number }> {
        const where: Prisma.AmbassadorCampaignEnrollmentWhereInput = {
            ambassadorId: params.ambassadorId,
            campaign: { organizationId: params.organizationId },
        };

        const [rows, total] = await prisma.$transaction([
            prisma.ambassadorCampaignEnrollment.findMany({
                where,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: "desc" },
                include: { campaign: { include: { contest: { select: { title: true, slug: true } } } } },
            }),
            prisma.ambassadorCampaignEnrollment.count({ where }),
        ]);

        return { rows, total };
    }

    async findEnrollment(campaignId: string, ambassadorId: string): Promise<AmbassadorCampaignEnrollment | null> {
        return prisma.ambassadorCampaignEnrollment.findUnique({
            where: { campaignId_ambassadorId: { campaignId, ambassadorId } },
        });
    }

    async findEnrollmentById(id: string): Promise<EnrollmentWithCampaign | null> {
        return prisma.ambassadorCampaignEnrollment.findUnique({
            where: { id },
            include: { campaign: { include: { contest: { select: { title: true, slug: true } } } } },
        });
    }

    async createEnrollment(campaignId: string, ambassadorId: string, referralCode: string): Promise<AmbassadorCampaignEnrollment> {
        return prisma.ambassadorCampaignEnrollment.create({
            data: { campaignId, ambassadorId, referralCode },
        });
    }

    /**
     * Real single lookup off the globally-unique referralCode, with the
     * contestId + ACTIVE check as a data-integrity guard rather than the
     * primary scoping mechanism (@@unique([contestId]) on AmbassadorCampaign
     * already makes "this contest's one active campaign" unambiguous).
     */
    async findEnrollmentByReferralCodeForContest(
        referralCode: string,
        contestId: string,
    ): Promise<AmbassadorCampaignEnrollment | null> {
        const enrollment = await prisma.ambassadorCampaignEnrollment.findUnique({
            where: { referralCode },
            include: { campaign: { select: { contestId: true, status: true } } },
        });
        if (!enrollment) return null;
        if (enrollment.campaign.contestId !== contestId) return null;
        if (enrollment.campaign.status !== AmbassadorCampaignStatus.LIVE) return null;
        return enrollment;
    }

    // Live stats support — computed at read time, never stored (§6.3)

    async countReferrals(enrollmentId: string): Promise<number> {
        return prisma.participant.count({ where: { referredByEnrollmentId: enrollmentId } });
    }

    async countReferralsForEnrollments(enrollmentIds: string[]): Promise<Map<string, number>> {
        if (enrollmentIds.length === 0) return new Map();
        const grouped = await prisma.participant.groupBy({
            by: ["referredByEnrollmentId"],
            where: { referredByEnrollmentId: { in: enrollmentIds } },
            _count: { _all: true },
        });
        const map = new Map<string, number>();
        for (const g of grouped) {
            if (g.referredByEnrollmentId) map.set(g.referredByEnrollmentId, g._count._all);
        }
        return map;
    }

    /** createdAt of the Nth (1-indexed) referral for this enrollment, or null if fewer than n exist. */
    async findNthReferralCreatedAt(enrollmentId: string, n: number): Promise<Date | null> {
        const rows = await prisma.participant.findMany({
            where: { referredByEnrollmentId: enrollmentId },
            orderBy: { createdAt: "asc" },
            skip: n - 1,
            take: 1,
            select: { createdAt: true },
        });
        return rows[0]?.createdAt ?? null;
    }

    /** All enrollments for a campaign with ambassador info — report + leaderboard source. Pilot scale: cheap to load whole. */
    async listEnrollmentsForCampaign(campaignId: string): Promise<EnrollmentWithAmbassador[]> {
        return prisma.ambassadorCampaignEnrollment.findMany({
            where: { campaignId },
            include: { ambassador: true },
        });
    }

    // Ambassador Structure (§3.3)

    async listGroups(campaignId: string): Promise<AmbassadorGroup[]> {
        return prisma.ambassadorGroup.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } });
    }

    /** Transactional delete-all + recreate — see the note on ReplaceGroupsSchema for why this
     *  module treats the group list as one replace-all unit rather than per-row CRUD. */
    async replaceGroups(
        campaignId: string,
        groups: { groupType: string; name: string; ambassadorTarget?: number | undefined; registrationTarget?: number | undefined }[],
    ): Promise<AmbassadorGroup[]> {
        return prisma.$transaction(async (tx) => {
            await tx.ambassadorGroup.deleteMany({ where: { campaignId } });
            if (groups.length === 0) return [];
            await tx.ambassadorGroup.createMany({
                data: groups.map((g) => ({
                    campaignId,
                    groupType: g.groupType,
                    name: g.name,
                    ambassadorTarget: g.ambassadorTarget ?? null,
                    registrationTarget: g.registrationTarget ?? null,
                })),
            });
            return tx.ambassadorGroup.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } });
        });
    }

    // ─── Campaign Templates (§3.4, Phase 5) ─────────────────────────────────────

    async createTemplate(data: {
        organizationId: string;
        name: string;
        ambassadorTypesAllowed: string[];
        rewardConfig: Prisma.InputJsonValue;
        shareTemplates: Prisma.InputJsonValue;
        groups: Prisma.InputJsonValue;
        sourceCampaignId?: string | null;
        createdById: string;
    }): Promise<AmbassadorCampaignTemplate> {
        return prisma.ambassadorCampaignTemplate.create({ data });
    }

    async findTemplateById(id: string, organizationId: string): Promise<AmbassadorCampaignTemplate | null> {
        return prisma.ambassadorCampaignTemplate.findFirst({ where: { id, organizationId } });
    }

    async findAllTemplates(filter: FindTemplatesFilter): Promise<{ rows: AmbassadorCampaignTemplate[]; total: number }> {
        const where: Prisma.AmbassadorCampaignTemplateWhereInput = { organizationId: filter.organizationId };

        const [rows, total] = await prisma.$transaction([
            prisma.ambassadorCampaignTemplate.findMany({
                where,
                skip: filter.skip,
                take: filter.take,
                orderBy: { [filter.sortBy]: filter.sortOrder },
            }),
            prisma.ambassadorCampaignTemplate.count({ where }),
        ]);

        return { rows, total };
    }

    async deleteTemplate(id: string, organizationId: string): Promise<void> {
        await prisma.ambassadorCampaignTemplate.deleteMany({ where: { id, organizationId } });
    }
}
