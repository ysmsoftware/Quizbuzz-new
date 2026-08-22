import { z } from "zod";
import { LeaderboardQuerySchema as CampaignLeaderboardQuerySchema } from "../ambassador-campaign/ambassador-campaign.validator";

const emailField = z.string().email("Invalid email address").toLowerCase().trim();

const phoneField = z
    .preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        return val;
    }, z.string().trim().min(6).max(20).optional());

// Org-scoped: "which ambassador types has THIS org enabled" — used by org-admin campaign
// config screens (ambassadorTypesAllowed picker), not the platform-level signup flow below.
export const GetOrgTypesQuerySchema = z.object({
    organizationId: z.string().min(1),
});

// ─── Signup (2-step) ─────────────────────────────────────────────────────────

export const SignupStartSchema = z.object({
    firstName: z.string().min(1, "First name is required").max(100).trim(),
    lastName: z.string().max(100).trim().optional(),
    email: emailField,
    phone: phoneField,
});

export const SignupVerifyOtpSchema = z.object({
    email: emailField,
    otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
});

export const SignupCompleteSchema = z.object({
    email: emailField,
    ambassadorType: z.string().min(1),
    applicationData: z.record(z.string(), z.any()).default({}),
    proofStorageKey: z.string().min(1),
    proofUrl: z.string().min(1),
});

export const UploadProofRequestSchema = z.object({
    filename: z.string().min(1),
    mimeType: z.string().min(1),
});

// ─── Profile ─────────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
    firstName: z.string().min(1, "First name is required").max(100).trim().optional(),
    lastName: z.string().max(100).trim().nullable().optional(),
    phone: phoneField,
    // Keyed by whatever fields the ambassador's *current* type definition asks for (see
    // ambassador-types.ts) — validated against that definition in the service, not here,
    // since this schema has no way to know which type this ambassador is.
    applicationData: z.record(z.string(), z.string()).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export const UpdateProofSchema = z.object({
    proofStorageKey: z.string().min(1),
    proofUrl: z.string().min(1),
});

// Profile photo is always set as a pair, or cleared as a pair — no independent-field update.
export const UpdateProfileImageSchema = z.union([
    z.object({ profileImageStorageKey: z.string().min(1), profileImageUrl: z.string().min(1) }),
    z.object({ profileImageStorageKey: z.null(), profileImageUrl: z.null() }),
]);

// ─── Login (returning ambassador) ───────────────────────────────────────────

export const RequestOtpSchema = z.object({
    email: emailField,
});

export const VerifyOtpSchema = z.object({
    email: emailField,
    otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
});

// ─── Campaigns ───────────────────────────────────────────────────────────────

export const ListCampaignsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Same query shape as the org-admin leaderboard endpoint — reused, not duplicated, so both
// stay in sync with LeaderboardScope's shape (see ambassador-campaign.validator.ts).
export const LeaderboardQuerySchema = CampaignLeaderboardQuerySchema;

// 14 days (not 7) is the default so callers can compute a this-week-vs-last-week trend
// client-side from one response, then slice the most recent 7 for the sparkline itself.
export const ActivityQuerySchema = z.object({
    days: z.coerce.number().int().min(1).max(30).default(14),
});

export type GetOrgTypesQueryInput = z.infer<typeof GetOrgTypesQuerySchema>;
export type SignupStartInput = z.infer<typeof SignupStartSchema>;
export type SignupVerifyOtpInput = z.infer<typeof SignupVerifyOtpSchema>;
export type SignupCompleteInput = z.infer<typeof SignupCompleteSchema>;
export type UploadProofRequestInput = z.infer<typeof UploadProofRequestSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type UpdateProofInput = z.infer<typeof UpdateProofSchema>;
export type UpdateProfileImageInput = z.infer<typeof UpdateProfileImageSchema>;
export type RequestOtpInput = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ListCampaignsQueryInput = z.infer<typeof ListCampaignsQuerySchema>;
export type LeaderboardQueryInput = z.infer<typeof LeaderboardQuerySchema>;
