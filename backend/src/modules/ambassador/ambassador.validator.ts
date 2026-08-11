import { z } from "zod";

const emailField = z.string().email("Invalid email address").toLowerCase().trim();

const phoneField = z
    .preprocess((val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        return val;
    }, z.string().trim().min(6).max(20).optional());

export const GetTypesQuerySchema = z.object({
    organizationId: z.string().min(1),
});

export const ApplySchema = z.object({
    organizationId: z.string().min(1),
    firstName: z.string().min(1, "First name is required").max(100).trim(),
    lastName: z.string().max(100).trim().optional(),
    email: emailField,
    phone: phoneField,
    ambassadorType: z.string().min(1),
    applicationData: z.record(z.string(), z.any()).default({}),
    proofStorageKey: z.string().min(1),
    proofUrl: z.string().min(1),
});

export const UploadProofRequestSchema = z.object({
    organizationId: z.string().min(1),
    filename: z.string().min(1),
    mimeType: z.string().min(1),
});

export const RequestOtpSchema = z.object({
    email: emailField,
    organizationId: z.string().min(1),
});

export const VerifyOtpSchema = z.object({
    email: emailField,
    organizationId: z.string().min(1),
    otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
});

export const ListCampaignsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const LeaderboardQuerySchema = z.object({
    scope: z.enum(["INDIVIDUAL_AMBASSADOR", "DEPARTMENT", "INTER_COLLEGE_DEPARTMENT", "COLLEGE"]),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ApplyInput = z.infer<typeof ApplySchema>;
export type UploadProofRequestInput = z.infer<typeof UploadProofRequestSchema>;
export type RequestOtpInput = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ListCampaignsQueryInput = z.infer<typeof ListCampaignsQuerySchema>;
export type LeaderboardQueryInput = z.infer<typeof LeaderboardQuerySchema>;
