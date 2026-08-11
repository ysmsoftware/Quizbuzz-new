import { z } from "zod";
import { AmbassadorCampaignStatus } from "@prisma/client";

const goodieSchema = z.object({
    label: z.string().min(1),
    cashEquivalent: z.number().min(0).optional(),
});

const milestoneTierSchema = z.object({
    label: z.string().min(1).optional(),
    minRegistrations: z.number().int().min(0),
    maxRegistrations: z.number().int().min(0).nullable(),
    rewardType: z.enum(["PER_REGISTRATION", "FLAT_PLUS_PER_REG"]),
    amountPerRegistration: z.number().min(0),
    goodie: goodieSchema.optional(),
});

const speedBonusSchema = z.object({
    enabled: z.boolean(),
    campaignStartAt: z.string().min(1),
    milestoneThreshold: z.number().int().min(1),
    tiers: z.array(z.object({
        withinDays: z.number().int().min(1),
        bonusAmount: z.number().min(0),
        label: z.string().min(1),
        goodie: goodieSchema.optional(),
    })).min(1),
});

const leaderboardCutSchema = z.object({
    scope: z.enum(["INDIVIDUAL_AMBASSADOR", "DEPARTMENT", "INTER_COLLEGE_DEPARTMENT", "COLLEGE"]),
    label: z.string().min(1),
    rankedBy: z.literal("REGISTRATION_RATE_PERCENT").optional(),
    winnerCount: z.number().int().min(1).optional(),
    ranks: z.array(z.object({
        rank: z.number().int().min(1).optional(),
        rankRange: z.tuple([z.number().int().min(1), z.number().int().min(1)]).optional(),
        cashAmount: z.number().min(0).optional(),
        goodie: goodieSchema.optional(),
        label: z.string().optional(),
    })),
    consolation: z.object({ label: z.string().min(1), cashAmount: z.number().min(0) }).optional(),
});

const rewardConfigSchema = z.object({
    currency: z.string().min(1),
    amountsInPaise: z.literal(true),
    milestoneTiers: z.array(milestoneTierSchema).min(1),
    speedBonus: speedBonusSchema.optional(),
    leaderboardPrizes: z.array(leaderboardCutSchema),
});

const shareTemplatesSchema = z.object({
    whatsappText: z.string().optional(),
    instagramText: z.string().optional(),
    posterImageUrl: z.string().optional(),
});

export const CreateCampaignSchema = z.object({
    contestId: z.string().min(1),
    name: z.string().min(1).max(200).trim(),
    ambassadorTypesAllowed: z.array(z.string().min(1)).min(1),
    rewardConfig: rewardConfigSchema,
    shareTemplates: shareTemplatesSchema.optional(),
});

export const UpdateCampaignSchema = z.object({
    name: z.string().min(1).max(200).trim().optional(),
    ambassadorTypesAllowed: z.array(z.string().min(1)).min(1).optional(),
    rewardConfig: rewardConfigSchema.optional(),
    shareTemplates: shareTemplatesSchema.optional(),
    status: z.nativeEnum(AmbassadorCampaignStatus).optional(),
}).refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided for update" }
);

export const DuplicateCampaignSchema = z.object({
    contestId: z.string().min(1),
});

export const ListCampaignsQuerySchema = z.object({
    status: z.nativeEnum(AmbassadorCampaignStatus).optional(),
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

export const ListReportQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["registrationCount", "createdAt"]).default("registrationCount"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const LeaderboardQuerySchema = z.object({
    scope: z.enum(["INDIVIDUAL_AMBASSADOR", "DEPARTMENT", "INTER_COLLEGE_DEPARTMENT", "COLLEGE"]),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
export type DuplicateCampaignInput = z.infer<typeof DuplicateCampaignSchema>;
export type ListCampaignsQueryInput = z.infer<typeof ListCampaignsQuerySchema>;
export type ListApplicationsQueryInput = z.infer<typeof ListApplicationsQuerySchema>;
export type RejectApplicationInput = z.infer<typeof RejectApplicationSchema>;
export type ListReportQueryInput = z.infer<typeof ListReportQuerySchema>;
export type LeaderboardQueryInput = z.infer<typeof LeaderboardQuerySchema>;
