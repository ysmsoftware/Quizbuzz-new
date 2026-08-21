import { Ambassador, AmbassadorCampaign, AmbassadorCampaignEnrollment, AmbassadorCampaignStatus, AmbassadorCampaignTemplate, AmbassadorGroup, AmbassadorStatus, Prisma } from "@prisma/client";
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
export type CampaignWithContestAndOrg = AmbassadorCampaign & {
    contest: { title: string; slug: string } | null;
    organization: { name: string; slug: string };
    _count: { enrollments: number };
};
export type EnrollmentWithCampaign = AmbassadorCampaignEnrollment & {
    campaign: AmbassadorCampaign & { contest: { title: string; slug: string } | null };
};
export type EnrollmentWithCampaignAndOrg = AmbassadorCampaignEnrollment & {
    campaign: AmbassadorCampaign & { contest: { title: string; slug: string } | null; organization: { name: string; slug: string } };
};
export type EnrollmentWithAmbassador = AmbassadorCampaignEnrollment & { ambassador: Ambassador };
export type EnrollmentWithAmbassadorAndCampaignName = AmbassadorCampaignEnrollment & { ambassador: Ambassador; campaign: { name: string } };
export type EnrollmentWithAmbassadorAndCampaignSummary = AmbassadorCampaignEnrollment & {
    ambassador: Ambassador;
    campaign: { id: string; name: string; status: AmbassadorCampaignStatus; rewardConfig: Prisma.JsonValue };
};

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

    /** Org-agnostic lookup — used by the ambassador-facing side, where a campaign's
     *  organization is just data to display, not a scoping/access-control boundary
     *  (an ambassador identity isn't tied to any one org). */
    async findByIdGlobal(id: string): Promise<CampaignWithContestTitle | null> {
        return prisma.ambassadorCampaign.findUnique({
            where: { id },
            include: { contest: { select: { title: true, slug: true } }, _count: { select: { enrollments: true } } },
        });
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

    /** Cross-organization browse — same "not scoped to one org" shape as the public
     *  /contests listing, just filtered to this ambassador's own type. */
    async findActiveForType(params: {
        ambassadorType: string;
        excludeCampaignIds: string[];
        skip: number;
        take: number;
    }): Promise<{ rows: CampaignWithContestAndOrg[]; total: number }> {
        const where: Prisma.AmbassadorCampaignWhereInput = {
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
                include: {
                    contest: { select: { title: true, slug: true } },
                    organization: { select: { name: true, slug: true } },
                    _count: { select: { enrollments: true } },
                },
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

    /** Cross-organization — an ambassador's applications, whichever org each campaign
     *  belongs to (mirrors findActiveForType's org-agnostic browsing below). */
    async findEnrollmentsByAmbassadorGlobal(params: {
        ambassadorId: string;
        skip: number;
        take: number;
    }): Promise<{ rows: EnrollmentWithCampaignAndOrg[]; total: number }> {
        const where: Prisma.AmbassadorCampaignEnrollmentWhereInput = { ambassadorId: params.ambassadorId };

        const [rows, total] = await prisma.$transaction([
            prisma.ambassadorCampaignEnrollment.findMany({
                where,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: "desc" },
                include: {
                    campaign: {
                        include: {
                            contest: { select: { title: true, slug: true } },
                            organization: { select: { name: true, slug: true } },
                        },
                    },
                },
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
     *
     * Also gates on enrollment.status === APPROVED: a referral code is assigned the
     * moment someone one-click-applies (status PENDING), but only counts toward
     * attribution once that campaign's organization has approved the application —
     * otherwise anyone could grab a link before ever being reviewed.
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
        if (enrollment.status !== AmbassadorStatus.APPROVED) return null;
        if (enrollment.campaign.contestId !== contestId) return null;
        if (enrollment.campaign.status !== AmbassadorCampaignStatus.LIVE) return null;
        return enrollment;
    }

    /**
     * Public-safe preview data for a referral link's WhatsApp/social link-preview card —
     * just enough to render an Open Graph image + title (the campaign's poster + name, and
     * the referring ambassador's first name). Gated by the exact same validity checks as
     * findEnrollmentByReferralCodeForContest above (APPROVED, right contest, campaign LIVE) —
     * an invalid/unattributable code returns null rather than leaking campaign data for a
     * code that wouldn't actually count toward attribution either. Never exposes reward
     * config, applicationData, or anything else that isn't already public on the share kit.
     */
    async findReferralPreviewForContest(
        referralCode: string,
        contestId: string,
    ): Promise<{ campaignName: string; posterImageUrl?: string | undefined; ambassadorFirstName: string } | null> {
        const enrollment = await prisma.ambassadorCampaignEnrollment.findUnique({
            where: { referralCode },
            include: {
                campaign: { select: { contestId: true, status: true, name: true, shareTemplates: true } },
                ambassador: { select: { firstName: true } },
            },
        });
        if (!enrollment) return null;
        if (enrollment.status !== AmbassadorStatus.APPROVED) return null;
        if (enrollment.campaign.contestId !== contestId) return null;
        if (enrollment.campaign.status !== AmbassadorCampaignStatus.LIVE) return null;
        const shareTemplates = enrollment.campaign.shareTemplates as { posterImageUrl?: string } | null;
        return {
            campaignName: enrollment.campaign.name,
            posterImageUrl: shareTemplates?.posterImageUrl,
            ambassadorFirstName: enrollment.ambassador.firstName,
        };
    }

    // ─── Applications review (org-admin) — operates on enrollments, the per-campaign
    // approval unit, not on Ambassador (which is now a global identity with no status) ──

    async findApplications(params: {
        organizationId: string;
        statuses: string[];
        skip: number;
        take: number;
        sortBy: "appliedAt" | "firstName";
        sortOrder: "asc" | "desc";
    }): Promise<{ rows: EnrollmentWithAmbassadorAndCampaignName[]; total: number }> {
        const where: Prisma.AmbassadorCampaignEnrollmentWhereInput = {
            campaign: { organizationId: params.organizationId },
            ...(params.statuses.length > 0 ? { status: { in: params.statuses as AmbassadorStatus[] } } : {}),
        };
        const orderBy: Prisma.AmbassadorCampaignEnrollmentOrderByWithRelationInput =
            params.sortBy === "firstName"
                ? { ambassador: { firstName: params.sortOrder } }
                : { createdAt: params.sortOrder };

        const [rows, total] = await prisma.$transaction([
            prisma.ambassadorCampaignEnrollment.findMany({
                where,
                skip: params.skip,
                take: params.take,
                orderBy,
                include: { ambassador: true, campaign: { select: { name: true } } },
            }),
            prisma.ambassadorCampaignEnrollment.count({ where }),
        ]);

        return { rows, total };
    }

    async findApplicationById(id: string, organizationId: string): Promise<EnrollmentWithAmbassadorAndCampaignName | null> {
        return prisma.ambassadorCampaignEnrollment.findFirst({
            where: { id, campaign: { organizationId } },
            include: { ambassador: true, campaign: { select: { name: true } } },
        });
    }

    async updateApplicationStatus(
        id: string,
        data: { status: AmbassadorStatus; reviewedById?: string; rejectionReason?: string | null },
    ): Promise<EnrollmentWithAmbassadorAndCampaignName> {
        return prisma.ambassadorCampaignEnrollment.update({
            where: { id },
            data: { ...data, reviewedAt: new Date() },
            include: { ambassador: true, campaign: { select: { name: true } } },
        });
    }

    // ─── Ambassador directory (org-admin) — org-wide, across every campaign this org owns,
    // as opposed to findApplications above which is per-campaign and any status ──────────

    /** Every APPROVED enrollment across every campaign this org owns, ambassador + a light
     *  campaign summary included. One ambassador can appear more than once here (once per
     *  campaign they're approved for) — grouped into one row per person in the service
     *  layer. Same "load it all, group/compute in memory" pilot-scale approach as
     *  listEnrollmentsForCampaign/_buildReportRows, just spanning every campaign instead of
     *  one. */
    async findApprovedEnrollmentsForOrg(organizationId: string): Promise<EnrollmentWithAmbassadorAndCampaignSummary[]> {
        return prisma.ambassadorCampaignEnrollment.findMany({
            where: { status: AmbassadorStatus.APPROVED, campaign: { organizationId } },
            include: { ambassador: true, campaign: { select: { id: true, name: true, status: true, rewardConfig: true } } },
            orderBy: { createdAt: "desc" },
        });
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

    /** Every enrollment id this ambassador has APPROVED, across every campaign/org — the
     *  denominator for a cross-campaign activity trend (dashboard sparkline). */
    async listApprovedEnrollmentIdsForAmbassador(ambassadorId: string): Promise<string[]> {
        const rows = await prisma.ambassadorCampaignEnrollment.findMany({
            where: { ambassadorId, status: AmbassadorStatus.APPROVED },
            select: { id: true },
        });
        return rows.map((r) => r.id);
    }

    /** Raw referral timestamps since a cutoff — bucketed into days by the caller (same
     *  "load raw, compute in service" approach as the rest of this file's live-stats
     *  queries, see campaign-stats.ts). */
    async listReferralCreatedAtSince(enrollmentIds: string[], since: Date): Promise<Date[]> {
        if (enrollmentIds.length === 0) return [];
        const rows = await prisma.participant.findMany({
            where: { referredByEnrollmentId: { in: enrollmentIds }, createdAt: { gte: since } },
            select: { createdAt: true },
        });
        return rows.map((r) => r.createdAt);
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
