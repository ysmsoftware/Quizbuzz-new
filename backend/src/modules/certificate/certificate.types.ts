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
 *
 * Fields added here are automatically picked up by certificate.template.ts
 * via the buildRenderContext() function — no worker changes needed.
 */
export interface CertificateMetadata {
    // ── Required ─────────────────────────────────────────────────────────────
    participantName:  string;
    contestTitle:     string;
    issuedAt:         string;   // ISO string — date the cert was issued

    // ── Performance (optional — rendered as stat pills when present) ──────────
    score?:           number | undefined;
    percentage?:      number | undefined;
    rank?:            number | undefined;
    timeTakenSecs?:   number | undefined;

    // ── Contest metadata ──────────────────────────────────────────────────────
    /**
     * Human-readable date of the contest event itself.
     * Falls back to `issuedAt` if not supplied.
     * Example: "2025-09-14T10:00:00.000Z" → rendered as "14 September 2025"
     */
    contestDate?:     string | undefined;

    // ── Organisation branding (optional — defaults applied in template) ───────
    /**
     * Display name of the organising body.
     * Shown in the footer and used as alt-text for the logo.
     * Defaults to "QuizBuzz" if not set.
     */
    orgName?:         string | undefined;

    /**
     * Publicly accessible URL of the org logo (HTTPS).
     * Puppeteer will fetch this image at render time — must be reachable
     * from the Chromium sandbox (no localhost URLs in production).
     * If null / absent, org name text is rendered instead.
     */
    orgLogoUrl?:      string | undefined;

    /**
     * Primary brand colour as a 6-digit hex string (e.g. "#1a3a6b").
     * Controls border, title, stats pills, and top bar colour.
     * Defaults to "#1a3a6b" (QuizBuzz navy) if not set.
     */
    primaryColor?:    string | undefined;

    // ── Template selection ────────────────────────────────────────────────────
    /**
     * Explicit template variant override.
     * If omitted, the variant is inferred automatically from rank/percentage:
     *   rank 1-3 OR percentage >= 90  → MERIT
     *   percentage >= 60              → ACHIEVEMENT
     *   otherwise                     → PARTICIPATION
     *
     * Valid values: "PARTICIPATION" | "ACHIEVEMENT" | "MERIT"
     */
    templateVariant?: string | undefined;

    /**
     * Legacy field — kept for backward compatibility.
     * Use `templateVariant` for new code.
     */
    templateId?:      string | undefined;

    // ── Extension ─────────────────────────────────────────────────────────────
    /** Arbitrary extra fields per contest (e.g. custom award name, etc.). */
    [key: string]: any;
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

// ─── Dashboard specific types ──────────────────────────────────────────────────

export interface CertificateDashboardRecord {
    participant: {
        id:              string;
        registrationRef: string;
        status:          string;
        contact: {
            firstName: string;
            lastName:  string | null;
            email:     string;
        };
    };
    certificate: {
        id:          string;
        status:      CertificateStatus;
        fileUrl:     string | null;
        generatedAt: Date | null;
        deliveredAt: Date | null;
    } | null;
    certStatus: string;
}

export interface CertificateDashboardSummary {
    generated: number;
    failed:    number;
    pending:   number;
}

export interface PaginatedCertificateDashboardResult {
    data:       CertificateDashboardRecord[];
    pagination: {
        total:      number;
        page:       number;
        limit:      number;
        totalPages: number;
    };
    summary:    CertificateDashboardSummary;
}

