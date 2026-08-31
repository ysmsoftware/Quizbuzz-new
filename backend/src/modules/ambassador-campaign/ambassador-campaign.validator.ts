import { z } from "zod";
import { AmbassadorCampaignStatus } from "@prisma/client";
import { LeaderboardScopeKind } from "./ambassador-campaign.types";

const goodieSchema = z.object({
    label: z.string().trim().min(1, "Goodie name is required"),
    cashEquivalent: z.number().min(0, "Goodie value must be 0 or greater").optional(),
});

const milestoneTierSchema = z.object({
    label: z.string().trim().transform((val) => val || undefined).optional(),
    minRegistrations: z.number().int().min(0, "Min registrations must be 0 or greater"),
    maxRegistrations: z.number().int().min(0, "Max registrations must be 0 or greater").nullable(),
    rewardType: z.enum(["PER_REGISTRATION", "FLAT_PLUS_PER_REG"]),
    amountPerRegistration: z.number().min(0, "Amount must be 0 or greater"),
    goodie: goodieSchema.optional(),
});

// Base shape, every field individually optional/defaulted — shared by both the lenient
// draft variant and the strict publish variant below. `campaignStartAtMode`/
// `campaignStartAtOffsetWeeks` are UX-only memory of how the frontend computed
// `campaignStartAt` ("same as the promoted contest's registration start", "N weeks after
// that", or "custom") — the actual speed-bonus math (reward-calculator.ts) only ever reads
// the resolved `campaignStartAt` ISO string, never these two, so they carry no validation
// weight beyond being well-typed.
const speedBonusFieldsSchema = z.object({
    enabled: z.boolean(),
    campaignStartAt: z.string().optional(),
    campaignStartAtMode: z.enum(["CONTEST_START", "OFFSET_WEEKS", "CUSTOM"]).optional(),
    campaignStartAtOffsetWeeks: z.number().int().min(0).optional(),
    milestoneThreshold: z.number().int().optional(),
    tiers: z.array(z.object({
        withinDays: z.number().int().min(1, "Days must be at least 1"),
        bonusAmount: z.number().min(0, "Bonus amount must be 0 or greater"),
        label: z.string().trim().min(1, "Bonus tier label is required"),
        maxWinners: z.number().int().min(1, "Max winners must be at least 1").optional(),
        goodie: goodieSchema.optional(),
    })).default([]),
});

// Strict — every field fully formed once enabled. Only run against the accumulated campaign
// row at publish time (via rewardConfigSchema, itself only used by PublishCampaignSchema),
// never against a single wizard-step PATCH — see speedBonusFieldsSchema below for that.
const speedBonusSchema = speedBonusFieldsSchema.superRefine((data, ctx) => {
    if (!data.enabled) return;
    if (!data.campaignStartAt || data.campaignStartAt.trim() === "") {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Campaign start date is required",
            path: ["campaignStartAt"],
        });
    }
    if (data.milestoneThreshold === undefined || data.milestoneThreshold < 1) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Milestone threshold must be at least 1",
            path: ["milestoneThreshold"],
        });
    }
    if (!data.tiers || data.tiers.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Add at least one speed bonus tier",
            path: ["tiers"],
        });
    }
});

// Base shape, no cross-field requirement — an "Add a group leaderboard" click starts a cut
// with `groupByFieldKeys: []` (see LeaderboardPrizesEditor.tsx's addGroupCut) before the admin
// has ticked any checkbox, and that half-filled cut rides along on the *next* save of any
// wizard step (the whole draft is resent every time), not just the Leaderboards step's own
// save. So this shape — the one embedded in draftRewardConfigSchema below — must not demand
// completeness, same rationale as speedBonusFieldsSchema above.
const leaderboardScopeFieldsSchema = z.object({
    kind: z.enum(["INDIVIDUAL_AMBASSADOR", "APPLICATION_FIELD_GROUP"]),
    groupByFieldKeys: z.array(z.string().min(1)).min(1).max(3).optional(),
});

// Strict — only run against the accumulated campaign row at publish time (via
// rewardConfigSchema, PublishCampaignSchema-only), never against a wizard-step PATCH.
const leaderboardScopeSchema = leaderboardScopeFieldsSchema.superRefine((data, ctx) => {
    if (data.kind === "APPLICATION_FIELD_GROUP" && (!data.groupByFieldKeys || data.groupByFieldKeys.length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select at least one field to group by.", path: ["groupByFieldKeys"] });
    }
    if (data.kind === "INDIVIDUAL_AMBASSADOR" && data.groupByFieldKeys) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "groupByFieldKeys must be omitted for INDIVIDUAL_AMBASSADOR.", path: ["groupByFieldKeys"] });
    }
});

// Shared shape for everything in a leaderboard cut except `scope`, which is the one field that
// differs between the draft and strict variants below.
const leaderboardCutRestSchema = {
    label: z.string().trim().min(1, "Section label is required"),
    rankedBy: z.literal("REGISTRATION_RATE_PERCENT").optional(),
    winnerCount: z.number().int().min(1, "Winner count must be at least 1").optional(),
    ranks: z.array(z.object({
        rank: z.number().int().min(1, "Rank must be at least 1").optional(),
        rankRange: z.tuple([z.number().int().min(1), z.number().int().min(1)]).optional(),
        cashAmount: z.number().min(0, "Cash amount must be 0 or greater").optional(),
        goodie: goodieSchema.optional(),
        label: z.string().trim().optional(),
    })),
    consolation: z.object({ label: z.string().trim().min(1, "Consolation label is required"), cashAmount: z.number().min(0, "Consolation cash amount must be 0 or greater") }).optional(),
};

// Lenient — used inside draftRewardConfigSchema (create/update). scope's own completeness
// isn't enforced yet, matching leaderboardScopeFieldsSchema's rationale above.
const leaderboardCutFieldsSchema = z.object({ scope: leaderboardScopeFieldsSchema, ...leaderboardCutRestSchema });

// Strict — used inside rewardConfigSchema (publish only).
const leaderboardCutSchema = z.object({ scope: leaderboardScopeSchema, ...leaderboardCutRestSchema });

// Strict — every section fully formed. Only run against the accumulated campaign row
// at publish time (POST /campaigns/:id/publish), never against a single wizard-step PATCH.
const rewardConfigSchema = z.object({
    currency: z.string().min(1, "Currency is required"),
    milestoneTiers: z.array(milestoneTierSchema).min(1, "Add at least one milestone reward tier."),
    speedBonus: speedBonusSchema.optional(),
    leaderboardPrizes: z.array(leaderboardCutSchema),
});

// Lenient — every field optional/defaulted so a campaign can be saved one wizard step at a
// time without the whole rewardConfig needing to be complete yet. Used by both
// CreateCampaignSchema (start a draft) and UpdateCampaignSchema (save a step / edit later).
const draftRewardConfigSchema = z.object({
    currency: z.string().min(1, "Currency is required").optional(),
    milestoneTiers: z.array(milestoneTierSchema).default([]),
    // Lenient fields-only shape (no superRefine) — an admin can flip Speed Bonus on and fill it
    // in gradually across several step-saves without every field needing to be complete yet.
    // Full completeness (campaignStartAt/milestoneThreshold/at least one tier, once enabled) is
    // only enforced by the strict speedBonusSchema inside rewardConfigSchema at publish time.
    speedBonus: speedBonusFieldsSchema.optional(),
    // Lenient fields-only cut shape — see leaderboardScopeFieldsSchema/leaderboardCutFieldsSchema
    // above. Full completeness (a group cut must actually name which field(s) to group by) is
    // only enforced by the strict leaderboardCutSchema inside rewardConfigSchema at publish time.
    leaderboardPrizes: z.array(leaderboardCutFieldsSchema).default([]),
});

// §6 — overridable campaign timeline phases. Base row shape, no cross-field requirement — used
// as-is (no min-length, no sum-to-1 check) inside CreateCampaignSchema/UpdateCampaignSchema so a
// half-edited "Customize phases" table (a row just added, fractions not yet rebalanced) doesn't
// block the *next* save of any other wizard step, the same rationale as every other
// *FieldsSchema above. Only phaseTemplateSchema below (min-length + sum-to-1, publish-only) is
// strict.
const phaseTemplateFieldsSchema = z.array(z.object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1),
    fraction: z.number().min(0).max(1),
}));

// Strict — only run against the accumulated campaign row at publish time
// (PublishCampaignSchema). Fractions must sum to ~1 (floating-point tolerance).
const phaseTemplateSchema = phaseTemplateFieldsSchema.min(1).refine(
    (entries) => Math.abs(entries.reduce((sum, e) => sum + e.fraction, 0) - 1) < 0.001,
    { message: "Phase fractions must sum to 1." },
);

// POST /campaigns/poster-upload-url — request a presigned S3 PUT URL for a campaign poster.
export const RequestPosterUploadUrlSchema = z.object({
    filename: z.string().min(1, "File name is required."),
    mimeType: z.string().min(1, "File type is required."),
});

const shareMessageTemplateSchema = z.object({
    id: z.string().min(1),
    label: z.string().trim().min(1, "Template name is required"),
    text: z.string(),
    includePoster: z.boolean(),
});

const shareTemplatesSchema = z.object({
    whatsappText: z.string().optional(),
    whatsappTemplates: z.array(shareMessageTemplateSchema).optional(),
    instagramText: z.string().optional(),
    posterImageUrl: z.string().optional(),
});

// POST /campaigns — starts a DRAFT. Only `name` is required; everything else is filled in
// step by step by the creation wizard and saved incrementally via PATCH.
export const CreateCampaignSchema = z.object({
    name: z.string().min(1).max(200).trim(),
    contestId: z.string().min(1).optional(),
    ambassadorTypesAllowed: z.array(z.string().min(1)).optional(),
    rewardConfig: draftRewardConfigSchema.optional(),
    shareTemplates: shareTemplatesSchema.optional(),
    // Lets the wizard's very first "Save & Continue" create the row already pointed at the
    // step the admin is moving to, instead of always defaulting to 1 (Basics) — see
    // CampaignWizard.tsx's persistAndGo, which otherwise has to remount on the create's
    // router.replace and re-hydrate from a stale wizardStep.
    wizardStep: z.number().int().min(1).max(8).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
});

// PATCH /campaigns/:id — one wizard step (or a post-publish edit) at a time. Deliberately
// lenient on rewardConfig/ambassadorTypesAllowed shape; full-campaign completeness is only
// enforced by PublishCampaignSchema at the Review & Publish step. `status` is deliberately
// NOT settable here — every transition (publish/activate/end/archive) goes through its own
// dedicated endpoint below so each one can run its own preconditions, the same way Contest
// separates updateContest from publishContest/rescheduleContest.
export const UpdateCampaignSchema = z.object({
    name: z.string().min(1).max(200).trim().optional(),
    contestId: z.string().min(1).optional(),
    ambassadorTypesAllowed: z.array(z.string().min(1)).optional(),
    rewardConfig: draftRewardConfigSchema.optional(),
    shareTemplates: shareTemplatesSchema.optional(),
    wizardStep: z.number().int().min(1).max(8).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    // Nullable, not just optional: the wizard's domain model uses `null` to mean "reset to the
    // built-in default phase breakdown" (see WizardDraft.phaseTemplate / campaign-timeline.ts),
    // and the whole accumulated draft is re-sent on every step save — so `null` shows up on
    // every PATCH once a campaign exists, not only when the Timeline step itself changes.
    // `.optional()` alone only accepts a missing key, never an explicit `null`. Uses the
    // lenient fields-only variant (no min-length/sum-to-1) — a half-edited "Customize phases"
    // table shouldn't block saving any other wizard step; strict min-length/sum-to-1 checking
    // only happens at publish time via PublishCampaignSchema below.
    phaseTemplate: phaseTemplateFieldsSchema.nullable().optional(),
}).refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided for update" }
);

// ─── Field-level edit locks (§4.4 of docs/ambassador-campaign-wizard-plan.md) ──────────────
// Config-driven allowlist, not a chain of `if (status !== X)` checks — same spirit as the
// engineering rulebook's "no magic numbers/hardcoded limits" rule, and directly mirrors
// ContestService.updateContest's editableStatuses/TIMING_FIELDS pattern (contest.service.ts).
// A field not listed here is never editable via PATCH once the campaign exists (there are
// none today, but this is the safe default for anything added later).
export const CAMPAIGN_FIELD_EDITABLE_STATUSES: Record<string, AmbassadorCampaignStatus[]> = {
    // Foundational to the campaign — who it's for and what it promotes. Changing either
    // after the wizard is done would invalidate campaigns already built around them.
    contestId: [AmbassadorCampaignStatus.DRAFT],
    ambassadorTypesAllowed: [AmbassadorCampaignStatus.DRAFT],
    // Economics — safe to tune before ambassadors are actively earning against the posted
    // numbers, locked once LIVE so nobody's rewards change out from under them mid-campaign.
    rewardConfig: [AmbassadorCampaignStatus.DRAFT, AmbassadorCampaignStatus.PUBLISHED],
    // Cosmetic/marketing — low risk, stays editable through the whole active lifecycle.
    name: [AmbassadorCampaignStatus.DRAFT, AmbassadorCampaignStatus.PUBLISHED, AmbassadorCampaignStatus.LIVE],
    shareTemplates: [AmbassadorCampaignStatus.DRAFT, AmbassadorCampaignStatus.PUBLISHED, AmbassadorCampaignStatus.LIVE],
    // Wizard bookkeeping only — meaningless once the campaign has left DRAFT.
    wizardStep: [AmbassadorCampaignStatus.DRAFT],
    // Timeline — same window as rewardConfig/groups: tunable while ambassadors are still
    // ramping up, locked once LIVE so phase boundaries (and anything computed from them,
    // e.g. speed-bonus deadlines) don't move under a campaign that's already running.
    startDate: [AmbassadorCampaignStatus.DRAFT, AmbassadorCampaignStatus.PUBLISHED],
    endDate: [AmbassadorCampaignStatus.DRAFT, AmbassadorCampaignStatus.PUBLISHED],
    phaseTemplate: [AmbassadorCampaignStatus.DRAFT, AmbassadorCampaignStatus.PUBLISHED],
};

export function editableFieldsFor(status: AmbassadorCampaignStatus): Set<string> {
    const fields = new Set<string>();
    for (const [field, statuses] of Object.entries(CAMPAIGN_FIELD_EDITABLE_STATUSES)) {
        if (statuses.includes(status)) fields.add(field);
    }
    return fields;
}

// POST /campaigns/:id/publish — validated server-side against the campaign's accumulated
// state (not the request body, which is empty). A ZodError here is caught by the same
// global error handler as any other Zod parse, so the frontend gets the same
// `{ code: "VALIDATION_ERROR", details: { "rewardConfig.milestoneTiers": [...] } }` shape
// it already knows how to render — used to deep-link the Review step back to the offending
// wizard step/field.
export const PublishCampaignSchema = z.object({
    contestId: z.string().min(1, "Select a quiz or contest to promote before publishing."),
    name: z.string().min(1).max(200).trim(),
    ambassadorTypesAllowed: z.array(z.string().min(1)).min(1, "Select at least one ambassador type."),
    rewardConfig: rewardConfigSchema,
    shareTemplates: shareTemplatesSchema.optional(),
    startDate: z.string().datetime({ message: "Set a campaign start date before publishing." }),
    endDate: z.string().datetime({ message: "Set a campaign end date before publishing." }),
    // Same nullable rationale as UpdateCampaignSchema above — a campaign that never customized
    // its phases has phaseTemplate: null in the database, which is a valid, complete state, not
    // a validation failure.
    phaseTemplate: phaseTemplateSchema.nullable().optional(),
}).refine(
    (data) => new Date(data.endDate).getTime() > new Date(data.startDate).getTime(),
    { message: "End date must be after start date.", path: ["endDate"] }
);

// ─── Ambassador Structure (§3.3) ────────────────────────────────────────────────
// PUT /campaigns/:id/groups — replace-all, not per-row CRUD: the wizard/dashboard editor
// always holds the full array client-side (same pattern as milestoneTiers/leaderboardPrizes),
// so one transactional "delete + recreate" call is simpler and avoids ever having to
// reconcile which rows are new/changed/removed.
const ambassadorGroupSchema = z.object({
    groupType: z.string().trim().min(1, "Group type is required").max(50, "Keep it under 50 characters"),
    name: z.string().min(1).max(200).trim(),
    ambassadorTarget: z.number().int().min(0).optional(),
    registrationTarget: z.number().int().min(0).optional(),
});

export const ReplaceGroupsSchema = z.object({
    groups: z.array(ambassadorGroupSchema),
});

export const DuplicateCampaignSchema = z.object({
    contestId: z.string().min(1),
});

// ─── Campaign Templates (§3.4, Phase 5) ─────────────────────────────────────────

export const CreateTemplateSchema = z.object({
    sourceCampaignId: z.string().min(1, "Select a campaign to save as a template."),
    name: z.string().min(1).max(200).trim(),
});

export const InstantiateTemplateSchema = z.object({
    contestId: z.string().min(1).optional(),
    name: z.string().min(1).max(200).trim().optional(),
});

export const ListTemplatesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["createdAt", "name"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Accepts either a single value (?status=PENDING) or a comma-separated list
// (?status=PENDING,SUSPENDED), same convention as dashboard.validator.ts.
const statusListSchema = z
    .string()
    .transform((val) => val.split(",").map((s) => s.trim()).filter(Boolean))
    .optional();

export const ListCampaignsQuerySchema = z.object({
    status: statusListSchema,
    ambassadorType: z.string().trim().min(1).optional(),
    q: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["createdAt", "name", "startDate", "status"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).transform((q) => ({
    statuses: q.status as AmbassadorCampaignStatus[] | undefined,
    ambassadorType: q.ambassadorType,
    q: q.q,
    page: q.page,
    limit: q.limit,
    sortBy: q.sortBy,
    sortOrder: q.sortOrder,
}));

export const ListApplicationsQuerySchema = z.object({
    status: statusListSchema,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["appliedAt", "firstName"]).default("appliedAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).transform((q) => ({
    statuses: q.status,
    page: q.page,
    limit: q.limit,
    sortBy: q.sortBy,
    sortOrder: q.sortOrder,
}));

export const RejectApplicationSchema = z.object({
    reason: z.string().min(1, "reason is required").max(500),
});

// The org-wide ambassador directory — distinct from ListApplicationsQuerySchema above (that's
// the per-campaign review queue, any status). This lists distinct, APPROVED people.
export const ListOrgAmbassadorsQuerySchema = z.object({
    q: z.string().trim().max(200).optional(),
    ambassadorType: z.string().trim().min(1).optional(),
    campaignId: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["joinedAt", "name", "registrations"]).default("joinedAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const ListReportQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["registrationCount", "createdAt"]).default("registrationCount"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ?scope=APPLICATION_FIELD_GROUP&groupByFieldKeys=college,department or ?scope=INDIVIDUAL_AMBASSADOR —
// query strings can't carry nested objects, so this is the flat encoding of leaderboardScopeSchema,
// same comma-separated-multi-value convention as statusListSchema.
export const LeaderboardQuerySchema = z.object({
    scope: z.enum(["INDIVIDUAL_AMBASSADOR", "APPLICATION_FIELD_GROUP"]),
    groupByFieldKeys: z.string().transform((val) => val.split(",").map((s) => s.trim()).filter(Boolean)).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
}).transform((q, ctx) => {
    const scope = leaderboardScopeSchema.safeParse({ kind: q.scope as LeaderboardScopeKind, groupByFieldKeys: q.groupByFieldKeys });
    if (!scope.success) {
        for (const issue of scope.error.issues) {
            ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
        }
        return z.NEVER;
    }
    return { scope: scope.data, page: q.page, limit: q.limit };
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
export type PublishCampaignInput = z.infer<typeof PublishCampaignSchema>;
export type ReplaceGroupsInput = z.infer<typeof ReplaceGroupsSchema>;
export type DuplicateCampaignInput = z.infer<typeof DuplicateCampaignSchema>;
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type InstantiateTemplateInput = z.infer<typeof InstantiateTemplateSchema>;
export type ListTemplatesQueryInput = z.infer<typeof ListTemplatesQuerySchema>;
export type ListCampaignsQueryInput = z.infer<typeof ListCampaignsQuerySchema>;
export type ListApplicationsQueryInput = z.infer<typeof ListApplicationsQuerySchema>;
export type ListOrgAmbassadorsQueryInput = z.infer<typeof ListOrgAmbassadorsQuerySchema>;
export type RejectApplicationInput = z.infer<typeof RejectApplicationSchema>;
export type ListReportQueryInput = z.infer<typeof ListReportQuerySchema>;
export type LeaderboardQueryInput = z.infer<typeof LeaderboardQuerySchema>;
