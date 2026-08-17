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
}).refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export const UpdateProofSchema = z.object({
    proofStorageKey: z.string().min(1),
    proofUrl: z.string().min(1),
});

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

export type GetOrgTypesQueryInput = z.infer<typeof GetOrgTypesQuerySchema>;
export type SignupStartInput = z.infer<typeof SignupStartSchema>;
export type SignupVerifyOtpInput = z.infer<typeof SignupVerifyOtpSchema>;
export type SignupCompleteInput = z.infer<typeof SignupCompleteSchema>;
export type UploadProofRequestInput = z.infer<typeof UploadProofRequestSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type UpdateProofInput = z.infer<typeof UpdateProofSchema>;
export type RequestOtpInput = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ListCampaignsQueryInput = z.infer<typeof ListCampaignsQuerySchema>;
export type LeaderboardQueryInput = z.infer<typeof LeaderboardQuerySchema>;
