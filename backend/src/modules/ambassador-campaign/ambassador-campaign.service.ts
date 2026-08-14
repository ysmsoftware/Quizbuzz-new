import crypto from "crypto";
import { AmbassadorCampaignStatus, Prisma } from "@prisma/client";
import { AmbassadorCampaignRepository } from "./ambassador-campaign.repository";
import { AmbassadorRepository } from "../ambassador/ambassador.repository";
import { OrganizationRepository } from "../organization/organization.repository";
import { EmailProvider } from "../../providers/email.provider";
import { FileStorageProvider } from "../../providers/storage.provider";
import { MessageTemplate } from "../../types/message-template.enum";
import { config } from "../../config";
import logger from "../../config/logger";
import { BadRequestError, ConflictError, NotFoundError } from "../../error/http-errors";
import { computeEnrollmentStats, computeLeaderboardGroups, findPrizeForRank, leaderboardScopeEquals } from "./campaign-stats";
import { calculateCampaignCapacity } from "./campaign-capacity";
import { generateCampaignPhases } from "./campaign-timeline";
import { AmbassadorResult } from "../ambassador/ambassador.types";
import { getAmbassadorTypeByKey } from "../../common/ambassador-types";
import { editableFieldsFor, PublishCampaignSchema } from "./ambassador-campaign.validator";
import {
    AmbassadorGroupInput,
    AmbassadorGroupResult,
    ApplicationReportRow,
    CampaignCapacity,
    CampaignListItem,
    CampaignPhase,
    CampaignPhaseTemplateEntry,
    CampaignResult,
    CampaignTarget,
    CreateCampaignDTO,
    CreateTemplateDTO,
    DraftRewardConfig,
    DuplicateCampaignDTO,
    InstantiateTemplateDTO,
    LeaderboardEntryResult,
    LeaderboardScope,
    ListApplicationsQueryDTO,
    ListCampaignsQueryDTO,
    ListReportQueryDTO,
    ListTemplatesQueryDTO,
    PaginatedResult,
    ReplaceGroupsDTO,
    RewardConfig,
    ShareTemplates,
    TemplateResult,
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

    // ─── Ambassador Kit — poster upload (presigned S3 PUT) ─────────────────────
    // Same shape as AmbassadorService.getUploadUrl (ambassador-proof docs): the frontend PUTs
    // the raw file straight to S3 with this URL, then strips the query string off it to get
    // the permanent object URL to save. No file ever passes through this backend.
    async getPosterUploadUrl(organizationId: string, filename: string, mimeType: string): Promise<{ url: string; storageKey: string }> {
        const organization = await this.organizationRepo.findById(organizationId);
        if (!organization) throw new NotFoundError("Organization not found.");

        const folder = `ambassador-campaign-poster/${organization.slug}/${crypto.randomUUID()}`;
        return this.storageProvider.getPresignedPutUrl({
            filename,
            folder,
            mimeType,
            expiresInSeconds: 300,
        });
    }

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

    /** Starts a DRAFT — only `name` is required. The creation wizard fills the rest in
     *  step by step via updateCampaign(), then finalizes with publishCampaign(). */
    async createCampaign(organizationId: string, createdById: string, dto: CreateCampaignDTO): Promise<CampaignResult> {
        if (dto.contestId) {
            const existing = await this.campaignRepo.findByContestId(dto.contestId, organizationId);
            if (existing) {
                throw new ConflictError("This contest already has an ambassador campaign.");
            }
        }

        const startDate = dto.startDate ? new Date(dto.startDate) : null;
        const endDate = dto.endDate ? new Date(dto.endDate) : null;
        const phases = this._computePhases(startDate, endDate);

        const campaign = await this.campaignRepo.create({
            organizationId,
            contestId: dto.contestId ?? null,
            name: dto.name,
            ambassadorTypesAllowed: dto.ambassadorTypesAllowed ?? [],
            rewardConfig: (dto.rewardConfig ?? {}) as unknown as Prisma.InputJsonValue,
            shareTemplates: (dto.shareTemplates ?? {}) as unknown as Prisma.InputJsonValue,
            createdById,
            startDate,
            endDate,
            phases: phases as unknown as Prisma.InputJsonValue,
        });

        const full = await this.campaignRepo.findById(campaign.id, organizationId);
        return this._toCampaignResult(full!);
    }

    /** A pure Zod schema can't see the org's live ambassador-type catalog, so this cross-check
     *  runs here: every APPLICATION_FIELD_GROUP cut's groupByFieldKeys must appear in at least
     *  one applicationFields[].key across the union of the campaign's ambassadorTypesAllowed
     *  types. Collects every violation before throwing, same posture as
     *  ambassador.service.ts's _validateApplicationData. */
    private async _validateLeaderboardFieldKeys(
        organizationId: string,
        ambassadorTypesAllowed: string[],
        rewardConfig: DraftRewardConfig,
    ): Promise<void> {
        const cuts = (rewardConfig.leaderboardPrizes ?? []).filter((c) => c.scope.kind === "APPLICATION_FIELD_GROUP");
        if (cuts.length === 0) return;

        const types = await Promise.all(ambassadorTypesAllowed.map((key) => getAmbassadorTypeByKey(key, organizationId)));
        const validKeys = new Set(types.flatMap((t) => t?.applicationFields.map((f) => f.key) ?? []));

        const invalid = new Set<string>();
        for (const cut of cuts) {
            for (const key of cut.scope.groupByFieldKeys ?? []) {
                if (!validKeys.has(key)) invalid.add(key);
            }
        }

        if (invalid.size > 0) {
            throw new BadRequestError(
                `Leaderboard group-by field(s) not found on any selected ambassador type: ${[...invalid].join(", ")}.`,
            );
        }
    }

    /** What a campaign promotes — today always a Contest. Internal naming seam only (§5): no
     *  behavior change, just replaces a bare `contestId` cast with a typed, named resolution
     *  step at the one call site (publishCampaign) that reasons about it as "the target". */
    private _resolveTarget(campaign: CampaignResult): CampaignTarget {
        if (!campaign.contestId) throw new BadRequestError("Campaign has no promotional target set.");
        return { type: "CONTEST", contestId: campaign.contestId };
    }

    /** Pure-function wrapper (§6, campaign-timeline.ts) — returns `[]` unless both dates are
     *  set, so a campaign mid-wizard with only one date filled in just has no preview yet. */
    private _computePhases(
        startDate: Date | null,
        endDate: Date | null,
        phaseTemplate?: CampaignPhaseTemplateEntry[] | null,
    ): CampaignPhase[] {
        if (!startDate || !endDate) return [];
        return generateCampaignPhases(startDate, endDate, phaseTemplate ?? undefined);
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
            statuses: query.statuses,
            ambassadorType: query.ambassadorType,
            q: query.q,
            skip,
            take: query.limit,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
        });

        const data: CampaignListItem[] = rows.map((c) => ({
            id: c.id,
            name: c.name,
            contestId: c.contestId,
            contestTitle: c.contest?.title ?? null,
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

        // Field-level edit lock — see CAMPAIGN_FIELD_EDITABLE_STATUSES in the validator for the
        // full table. A campaign that's e.g. LIVE can still have its share templates touched up,
        // but not its reward config or who it's promoting.
        const editable = editableFieldsFor(existing.status);
        const disallowed = Object.keys(dto).filter((field) => !editable.has(field));
        if (disallowed.length > 0) {
            throw new BadRequestError(
                `Cannot change ${disallowed.join(", ")} once a campaign is ${existing.status}.`,
            );
        }

        if (dto.contestId !== undefined && dto.contestId !== existing.contestId) {
            const conflict = await this.campaignRepo.findByContestId(dto.contestId, organizationId);
            if (conflict && conflict.id !== id) {
                throw new ConflictError("This contest already has an ambassador campaign.");
            }
        }

        if (dto.rewardConfig !== undefined) {
            const ambassadorTypesAllowed = dto.ambassadorTypesAllowed ?? existing.ambassadorTypesAllowed;
            await this._validateLeaderboardFieldKeys(organizationId, ambassadorTypesAllowed, dto.rewardConfig);
        }

        // Timeline — regenerate the phases snapshot whenever a date or the phase template
        // moves, using whichever value is newest (incoming DTO field, falling back to what's
        // already stored) so a wizard step that only sets one of the two dates doesn't wipe
        // the other.
        const startDate = dto.startDate !== undefined ? new Date(dto.startDate) : existing.startDate;
        const endDate = dto.endDate !== undefined ? new Date(dto.endDate) : existing.endDate;
        const phaseTemplate = dto.phaseTemplate !== undefined
            ? dto.phaseTemplate
            : (existing.phaseTemplate as unknown as CampaignPhaseTemplateEntry[] | null);
        const timelineChanged = dto.startDate !== undefined || dto.endDate !== undefined || dto.phaseTemplate !== undefined;
        const phases = timelineChanged ? this._computePhases(startDate, endDate, phaseTemplate) : undefined;

        await this.campaignRepo.updateById(id, organizationId, {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.contestId !== undefined && { contestId: dto.contestId }),
            ...(dto.ambassadorTypesAllowed !== undefined && { ambassadorTypesAllowed: dto.ambassadorTypesAllowed }),
            ...(dto.rewardConfig !== undefined && { rewardConfig: dto.rewardConfig as unknown as Prisma.InputJsonValue }),
            ...(dto.shareTemplates !== undefined && { shareTemplates: dto.shareTemplates as unknown as Prisma.InputJsonValue }),
            ...(dto.wizardStep !== undefined && { wizardStep: dto.wizardStep }),
            ...(dto.startDate !== undefined && { startDate }),
            ...(dto.endDate !== undefined && { endDate }),
            ...(dto.phaseTemplate !== undefined && { phaseTemplate: dto.phaseTemplate as unknown as Prisma.InputJsonValue }),
            ...(phases !== undefined && { phases: phases as unknown as Prisma.InputJsonValue }),
        });

        const full = await this.campaignRepo.findById(id, organizationId);
        return this._toCampaignResult(full!);
    }

    /** DRAFT → PUBLISHED. Validates the campaign's accumulated state (not the request body,
     *  which is empty) against the strict PublishCampaignSchema — a failure here is a normal
     *  ZodError, so it flows through the same global error handler as any other Zod parse and
     *  the frontend gets back per-field `details` it can use to deep-link into the wizard. */
    async publishCampaign(organizationId: string, id: string): Promise<CampaignResult> {
        const existing = await this.campaignRepo.findById(id, organizationId);
        if (!existing) throw new NotFoundError("Campaign not found.");
        if (existing.status !== AmbassadorCampaignStatus.DRAFT) {
            throw new ConflictError("Only draft campaigns can be published.");
        }

        PublishCampaignSchema.parse({
            contestId: existing.contestId,
            name: existing.name,
            ambassadorTypesAllowed: existing.ambassadorTypesAllowed,
            rewardConfig: existing.rewardConfig,
            shareTemplates: existing.shareTemplates,
            startDate: existing.startDate?.toISOString(),
            endDate: existing.endDate?.toISOString(),
            phaseTemplate: existing.phaseTemplate as unknown as CampaignPhaseTemplateEntry[] | null,
        });

        await this._validateLeaderboardFieldKeys(
            organizationId,
            existing.ambassadorTypesAllowed,
            existing.rewardConfig as unknown as DraftRewardConfig,
        );

        // Defensive re-check — the same conflict guard already runs when contestId is set via
        // updateCampaign(), but a campaign built through a burst of concurrent PATCHes shouldn't
        // be able to slip past it.
        const target = this._resolveTarget(this._toCampaignResult(existing));
        const conflict = await this.campaignRepo.findByContestId(target.contestId, organizationId);
        if (conflict && conflict.id !== id) {
            throw new ConflictError("This contest already has an ambassador campaign.");
        }

        await this.campaignRepo.updateById(id, organizationId, {
            status: AmbassadorCampaignStatus.PUBLISHED,
            publishedAt: new Date(),
            wizardStep: 8,
        });

        const full = await this.campaignRepo.findById(id, organizationId);
        return this._toCampaignResult(full!);
    }

    /** PUBLISHED → LIVE — ambassadors can now see the campaign and join. Kept as its own
     *  explicit action rather than derived automatically from Contest.status: campaigns and
     *  contests are separate modules today, and an admin may want to activate ambassador
     *  recruitment ahead of the contest's own registration window opening. */
    async activateCampaign(organizationId: string, id: string): Promise<CampaignResult> {
        return this._transitionStatus(organizationId, id, {
            allowedFrom: [AmbassadorCampaignStatus.PUBLISHED],
            to: AmbassadorCampaignStatus.LIVE,
            errorMessage: "Only published campaigns can be activated.",
        });
    }

    /** LIVE → ENDED — stops new joins/registrations counting toward it; rewards remain
     *  payable and the report/leaderboard stay readable, but the reward economics lock. */
    async endCampaign(organizationId: string, id: string): Promise<CampaignResult> {
        return this._transitionStatus(organizationId, id, {
            allowedFrom: [AmbassadorCampaignStatus.LIVE],
            to: AmbassadorCampaignStatus.ENDED,
            errorMessage: "Only live campaigns can be ended.",
        });
    }

    /** Any non-terminal status → ARCHIVED. One-way — matches the pre-Phase-1 behavior where
     *  ARCHIVED was already reachable (just via a raw status PATCH instead of a real action). */
    async archiveCampaign(organizationId: string, id: string): Promise<CampaignResult> {
        return this._transitionStatus(organizationId, id, {
            allowedFrom: Object.values(AmbassadorCampaignStatus).filter((s) => s !== AmbassadorCampaignStatus.ARCHIVED),
            to: AmbassadorCampaignStatus.ARCHIVED,
            errorMessage: "This campaign is already archived.",
        });
    }

    /** Shared guard-then-transition for the three simple one-way status moves above
     *  (activate/end/archive) — each is "fetch, check it's coming from an allowed status,
     *  flip it, return the fresh row," differing only in which statuses are allowed and what
     *  to call it. publishCampaign() is deliberately NOT folded in here: it also runs
     *  PublishCampaignSchema validation and sets publishedAt/wizardStep, enough extra
     *  behavior that sharing this helper would just replace duplication with branching. */
    private async _transitionStatus(
        organizationId: string,
        id: string,
        opts: { allowedFrom: AmbassadorCampaignStatus[]; to: AmbassadorCampaignStatus; errorMessage: string },
    ): Promise<CampaignResult> {
        const existing = await this.campaignRepo.findById(id, organizationId);
        if (!existing) throw new NotFoundError("Campaign not found.");
        if (!opts.allowedFrom.includes(existing.status)) {
            throw new ConflictError(opts.errorMessage);
        }

        await this.campaignRepo.updateById(id, organizationId, { status: opts.to });
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
            startDate: source.startDate,
            endDate: source.endDate,
            phases: (source.phases ?? []) as Prisma.InputJsonValue,
        });

        const full = await this.campaignRepo.findById(campaign.id, organizationId);
        return this._toCampaignResult(full!);
    }

    // ─── Ambassador Structure (§3.3) ────────────────────────────────────────────

    async getGroups(organizationId: string, campaignId: string): Promise<{ groups: AmbassadorGroupResult[]; capacity: CampaignCapacity }> {
        const campaign = await this.campaignRepo.findById(campaignId, organizationId);
        if (!campaign) throw new NotFoundError("Campaign not found.");

        const rows = await this.campaignRepo.listGroups(campaignId);
        const groups = rows.map((g) => this._toGroupResult(g));
        return { groups, capacity: calculateCampaignCapacity(groups) };
    }

    /** Same status window as rewardConfig (DRAFT + PUBLISHED, see CAMPAIGN_FIELD_EDITABLE_STATUSES)
     *  — structure feeds capacity/targets, which are just as economically meaningful once a
     *  campaign is LIVE as the reward tiers themselves, so it locks alongside them. Kept as a
     *  standalone check rather than folded into that table since groups live in their own
     *  table/endpoint, not the single-row campaign PATCH the table governs. */
    async replaceGroups(organizationId: string, campaignId: string, dto: ReplaceGroupsDTO): Promise<{ groups: AmbassadorGroupResult[]; capacity: CampaignCapacity }> {
        const campaign = await this.campaignRepo.findById(campaignId, organizationId);
        if (!campaign) throw new NotFoundError("Campaign not found.");

        const editableStatuses: AmbassadorCampaignStatus[] = [AmbassadorCampaignStatus.DRAFT, AmbassadorCampaignStatus.PUBLISHED];
        if (!editableStatuses.includes(campaign.status)) {
            throw new BadRequestError(`Ambassador structure can't be changed once a campaign is ${campaign.status}.`);
        }

        const rows = await this.campaignRepo.replaceGroups(campaignId, dto.groups);
        const groups = rows.map((g) => this._toGroupResult(g));
        return { groups, capacity: calculateCampaignCapacity(groups) };
    }

    private _toGroupResult(g: { id: string; campaignId: string; groupType: string; name: string; ambassadorTarget: number | null; registrationTarget: number | null; createdAt: Date }): AmbassadorGroupResult {
        return {
            id: g.id,
            campaignId: g.campaignId,
            groupType: g.groupType as AmbassadorGroupResult["groupType"],
            name: g.name,
            ambassadorTarget: g.ambassadorTarget ?? undefined,
            registrationTarget: g.registrationTarget ?? undefined,
            createdAt: g.createdAt,
        };
    }

    // ─── Campaign Templates (§3.4, Phase 5) ─────────────────────────────────────

    /** Saves a campaign's reusable config — ambassador types, reward config, share
     *  templates, and ambassador structure — as a standalone template, independent of the
     *  source campaign's status. Timeline (startDate/endDate/phases) is deliberately NOT
     *  captured: those are specific to one run of a campaign, not something worth reusing. */
    async createTemplate(organizationId: string, createdById: string, dto: CreateTemplateDTO): Promise<TemplateResult> {
        const source = await this.campaignRepo.findById(dto.sourceCampaignId, organizationId);
        if (!source) throw new NotFoundError("Campaign not found.");

        const groupRows = await this.campaignRepo.listGroups(dto.sourceCampaignId);
        const groups: AmbassadorGroupInput[] = groupRows.map((g) => ({
            groupType: g.groupType as AmbassadorGroupInput["groupType"],
            name: g.name,
            ambassadorTarget: g.ambassadorTarget ?? undefined,
            registrationTarget: g.registrationTarget ?? undefined,
        }));

        const template = await this.campaignRepo.createTemplate({
            organizationId,
            name: dto.name,
            ambassadorTypesAllowed: source.ambassadorTypesAllowed,
            rewardConfig: source.rewardConfig as Prisma.InputJsonValue,
            shareTemplates: source.shareTemplates as Prisma.InputJsonValue,
            groups: groups as unknown as Prisma.InputJsonValue,
            sourceCampaignId: source.id,
            createdById,
        });

        return this._toTemplateResult(template);
    }

    async listTemplates(organizationId: string, query: ListTemplatesQueryDTO): Promise<PaginatedResult<TemplateResult>> {
        const skip = (query.page - 1) * query.limit;
        const { rows, total } = await this.campaignRepo.findAllTemplates({
            organizationId,
            skip,
            take: query.limit,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
        });

        const data = rows.map((t) => this._toTemplateResult(t));

        return { data, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
    }

    async deleteTemplate(organizationId: string, id: string): Promise<void> {
        const existing = await this.campaignRepo.findTemplateById(id, organizationId);
        if (!existing) throw new NotFoundError("Template not found.");
        await this.campaignRepo.deleteTemplate(id, organizationId);
    }

    /** Creates a new DRAFT campaign pre-filled from a template — the wizard-picker equivalent
     *  of duplicateCampaign(), but from a template source instead of a live campaign. Ambassador
     *  structure is copied via the same replaceGroups() path a manual wizard save would use. */
    async instantiateTemplate(organizationId: string, createdById: string, templateId: string, dto: InstantiateTemplateDTO): Promise<CampaignResult> {
        const found = await this.campaignRepo.findTemplateById(templateId, organizationId);
        if (!found) throw new NotFoundError("Template not found.");
        const template = this._toTemplateResult(found);

        if (dto.contestId) {
            const existing = await this.campaignRepo.findByContestId(dto.contestId, organizationId);
            if (existing) {
                throw new ConflictError("This contest already has an ambassador campaign.");
            }
        }

        const campaign = await this.campaignRepo.create({
            organizationId,
            contestId: dto.contestId ?? null,
            name: dto.name ?? template.name,
            ambassadorTypesAllowed: template.ambassadorTypesAllowed,
            rewardConfig: template.rewardConfig as unknown as Prisma.InputJsonValue,
            shareTemplates: template.shareTemplates as unknown as Prisma.InputJsonValue,
            sourceTemplateId: template.id,
            createdById,
        });

        const groups = (template.groups ?? []) as unknown as { groupType: string; name: string; ambassadorTarget?: number | undefined; registrationTarget?: number | undefined }[];
        if (groups.length > 0) {
            await this.campaignRepo.replaceGroups(campaign.id, groups);
        }

        const full = await this.campaignRepo.findById(campaign.id, organizationId);
        return this._toCampaignResult(full!);
    }

    private _toTemplateResult(t: {
        id: string; organizationId: string; name: string; ambassadorTypesAllowed: string[];
        rewardConfig: unknown; shareTemplates: unknown; groups: unknown; sourceCampaignId: string | null;
        createdById: string; createdAt: Date;
    }): TemplateResult {
        return {
            id: t.id,
            organizationId: t.organizationId,
            name: t.name,
            ambassadorTypesAllowed: t.ambassadorTypesAllowed,
            rewardConfig: t.rewardConfig as unknown as DraftRewardConfig,
            shareTemplates: t.shareTemplates as unknown as ShareTemplates,
            groups: (t.groups ?? []) as unknown as AmbassadorGroupInput[],
            sourceCampaignId: t.sourceCampaignId,
            createdById: t.createdById,
            createdAt: t.createdAt,
        };
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

    /** Note: synchronous in-memory CSV — pilot-scale row counts, no BullMQ export worker needed. Upgrade when campaigns regularly exceed a few thousand ambassadors. */
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

        const rewardConfig = campaign.rewardConfig as unknown as DraftRewardConfig;
        const cut = (rewardConfig.leaderboardPrizes ?? []).find((c) => leaderboardScopeEquals(c.scope, scope));

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
        id: string; organizationId: string; contestId: string | null; name: string; ambassadorTypesAllowed: string[];
        rewardConfig: unknown; shareTemplates: unknown; sourceCampaignId: string | null; status: any; wizardStep: number;
        startDate: Date | null; endDate: Date | null; phases: unknown; phaseTemplate?: unknown;
        publishedAt: Date | null; createdById: string; createdAt: Date; updatedAt: Date;
    }): CampaignResult {
        return {
            id: c.id,
            organizationId: c.organizationId,
            contestId: c.contestId,
            name: c.name,
            ambassadorTypesAllowed: c.ambassadorTypesAllowed,
            rewardConfig: c.rewardConfig as unknown as DraftRewardConfig,
            shareTemplates: c.shareTemplates as unknown as ShareTemplates,
            sourceCampaignId: c.sourceCampaignId,
            status: c.status,
            wizardStep: c.wizardStep,
            startDate: c.startDate,
            endDate: c.endDate,
            phases: (c.phases ?? []) as unknown as CampaignPhase[],
            phaseTemplate: (c.phaseTemplate ?? null) as unknown as CampaignPhaseTemplateEntry[] | null,
            publishedAt: c.publishedAt,
            createdById: c.createdById,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        };
    }
}
