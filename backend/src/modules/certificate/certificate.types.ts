import { CertificateStatus } from "@prisma/client";

// ─── Enums ────────────────────────────────────────────────────────────────────

export { CertificateStatus };

// Status transition order — used to enforce forward-only state machine
export const CERTIFICATE_STATUS_ORDER: CertificateStatus[] = [
    "PENDING",
    "QUEUED",
    "GENERATING",
    "GENERATED",
    "DELIVERED",
    "FAILED",   // terminal — only reachable from GENERATING, retryable
];

// ─── Repository inputs ────────────────────────────────────────────────────────

export interface CreateCertificateInput {
    organizationId: string;
    contestId:      string;
    participantId:  string;
    metadata?:      CertificateMetadata;
}

/**
 * Template parameters stored at queue time and used by the worker when
 * rendering the HTML template. Everything the template needs lives here.
 */
export interface CertificateMetadata {
    participantName:  string;
    contestTitle:     string;
    score?:           number | undefined;
    percentage?:      number | undefined;
    rank?:            number | undefined;
    timeTakenSecs?:   number | undefined;
    issuedAt:         string;   // ISO string
    templateId?:      string | undefined;   // future: multi-template support
    [key: string]: any;     // allow arbitrary extra fields per contest
}

export interface UpdateCertificateStatusInput {
    status:       CertificateStatus;
    fileUrl?:     string;
    fileKey?:     string;
    generatedAt?: Date;
    deliveredAt?: Date;
    failureReason?: string;
}

// ─── DTOs — HTTP layer ────────────────────────────────────────────────────────

/** Input for single certificate issue via HTTP */
export interface IssueCertificateDTO {
    participantId?: string | undefined;
    contactId?:     string | undefined;
    contestId?:     string | undefined;
}

/** Input for bulk issue via HTTP */
export interface BulkIssueCertificateDTO {
    contestId: string;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface CertificateParticipantInfo {
    id:              string;
    registrationRef: string;
    contact: {
        id:        string;
        firstName: string;
        lastName:  string | null;
        email:     string;
    };
}

export interface CertificateResult {
    id:           string;
    contestId:    string;
    participantId: string;
    status:       CertificateStatus;
    fileUrl:      string | null;
    fileKey:      string | null;
    generatedAt:  Date | null;
    deliveredAt:  Date | null;
    metadata:     CertificateMetadata | null;
    createdAt:    Date;
    updatedAt:    Date;
    contest?: {
        id:    string;
        title: string;
    };
    participant?: CertificateParticipantInfo;
}

export interface PaginatedCertificatesResult {
    data:       CertificateResult[];
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
}

// ─── Queue payload ────────────────────────────────────────────────────────────

/**
 * Placed on BullMQ by CertificateService.
 * Contains everything the worker needs — no DB reads required just to start.
 */
export interface CertificateJobPayload {
    certificateId:  string;
    organizationId: string;
    contestId:      string;
    participantId:  string;
    metadata:       CertificateMetadata;
}
