// ─── DTOs (controller → service) ───────────────────────────────────────────────
//
// Signup is a 2-step flow, mirroring the platform-level identity model:
//   1. signupStart   — name/email/phone, sends an OTP. No Ambassador row yet.
//   2. signupComplete — after OTP is verified, the ambassador picks their type and
//      uploads proof. This is the point the Ambassador row is actually created.
// Between the two steps, the pending identity + OTP hash + "verified" flag live in
// Redis (see ambassadorSignupKey in ambassador.service.ts) — there's deliberately no
// partial/half-created Ambassador row while someone is mid-signup.

export interface SignupStartDTO {
    firstName: string;
    lastName?: string | undefined;
    email: string;
    phone?: string | undefined;
}

export interface SignupCompleteDTO {
    email: string;
    ambassadorType: string;
    applicationData: Record<string, unknown>;
    proofStorageKey: string;
    proofUrl: string;
}

export interface RequestUploadUrlDTO {
    filename: string;
    mimeType: string;
}

export interface UploadUrlResult {
    storageKey: string;
    url: string;
}

// ─── Result / input shapes ──────────────────────────────────────────────────────

export interface AmbassadorResult {
    id: string;
    email: string;
    phone: string | null;
    firstName: string;
    lastName: string | null;
    ambassadorType: string;
    applicationData: Record<string, unknown>;
    proofUrl: string;
    profileImageUrl: string | null;
    createdAt: Date;
}

export interface CreateAmbassadorInput {
    email: string;
    phone?: string | null | undefined;
    firstName: string;
    lastName?: string | null | undefined;
    ambassadorType: string;
    applicationData: Record<string, unknown>;
    proofStorageKey: string;
    proofUrl: string;
}
