import { AmbassadorStatus } from "@prisma/client";

// ─── DTOs (controller → service) ───────────────────────────────────────────────

export interface ApplyAmbassadorDTO {
    organizationId: string;
    firstName: string;
    lastName?: string | undefined;
    email: string;
    phone?: string | undefined;
    ambassadorType: string;
    applicationData: Record<string, unknown>;
    proofStorageKey: string;
    proofUrl: string;
}

export interface RequestUploadUrlDTO {
    organizationId: string;
    filename: string;
    mimeType: string;
}

// ─── Result / Filter shapes ─────────────────────────────────────────────────────

export interface AmbassadorResult {
    id: string;
    organizationId: string;
    email: string;
    phone: string | null;
    firstName: string;
    lastName: string | null;
    ambassadorType: string;
    applicationData: Record<string, unknown>;
    status: AmbassadorStatus;
    proofUrl: string;
    appliedAt: Date;
    reviewedAt: Date | null;
    rejectionReason: string | null;
}

export interface UploadUrlResult {
    storageKey: string;
    url: string;
}

export interface CreateAmbassadorInput {
    organizationId: string;
    email: string;
    phone?: string | null | undefined;
    firstName: string;
    lastName?: string | null | undefined;
    ambassadorType: string;
    applicationData: Record<string, unknown>;
    proofStorageKey: string;
    proofUrl: string;
}

export interface FindAmbassadorsFilter {
    organizationId: string;
    statuses?: string[] | undefined;
    skip: number;
    take: number;
    sortBy: "appliedAt" | "firstName";
    sortOrder: "asc" | "desc";
}
