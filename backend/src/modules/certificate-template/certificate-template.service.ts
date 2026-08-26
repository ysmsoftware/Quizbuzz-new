import crypto from "crypto";
import { CertificateTemplateRepository } from "./certificate-template.repository";
import { OrganizationRepository } from "../organization/organization.repository";
import { NotFoundError, ConflictError } from "../../error/http-errors";
import {
    CertificateTemplateResult,
    CertificateTemplateListItem,
    TemplatePreviewResult,
    TestGenerateInput,
    TestGenerateResult,
} from "./certificate-template.types";
import { renderCustomTemplateHtml } from "../certificate/certificate.template";
import { CertificateMetadata, CertificateTestJobPayload } from "../certificate/certificate.types";
import { certificateQueue, certificateQueueEvents } from "../../queues";
import { getStorageProvider } from "../../providers/storage.provider";
import logger from "../../config/logger";

/**
 * Same window as CERTIFICATE_DOWNLOAD_URL_TTL_SECONDS in certificate.service.ts —
 * a test PDF only needs to survive one admin session reviewing it, but there's no
 * harm matching the real-certificate window so this doesn't silently expire sooner
 * than an admin expects while still looking at the template editor.
 */
const TEST_CERTIFICATE_DOWNLOAD_URL_TTL_SECONDS = 3600 * 24; // 24h

/**
 * The only fields a custom template's {{placeholders}} can resolve to.
 * Mirrors CertificateRenderContext in certificate.template.ts exactly — single
 * source of truth for "what dynamic data does a certificate carry."
 * Deliberately excludes `templateVariant` (meaningless outside the 3 built-in designs).
 */
export const KNOWN_TEMPLATE_VARIABLES = [
    "participantName", "contestTitle", "contestDate",
    "orgName", "orgLogoUrl", "primaryColor",
    "score", "percentage", "rank", "timeTakenSecs",
    "issuedAt", "certificateId",
] as const;

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Strip <script> tags as defense-in-depth. Primary enforcement is disabling JS execution in Puppeteer at render time (see certificate.worker.ts) — this is a belt-and-suspenders text-level pass, not the security boundary itself. */
function sanitizeHtml(html: string): string {
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

// A4 landscape — the same fallback certificate.worker.ts's page.pdf() uses via
// `format: "A4", landscape: true` when the template doesn't declare its own @page size.
const DEFAULT_PAGE_SIZE_MM = { widthMm: 297, heightMm: 210 };

const PAGE_SIZE_RULE_RE = /@page\s*{[^}]*size\s*:\s*([^;]+);/i;

const NAMED_PAGE_SIZES_MM: Record<string, { widthMm: number; heightMm: number }> = {
    "a4 landscape":     { widthMm: 297, heightMm: 210 },
    "a4 portrait":      { widthMm: 210, heightMm: 297 },
    "a4":               { widthMm: 210, heightMm: 297 },
    "letter landscape": { widthMm: 279, heightMm: 216 },
    "letter portrait":  { widthMm: 216, heightMm: 279 },
    "letter":           { widthMm: 216, heightMm: 279 },
};

function unitsToMm(value: number, unit: string): number {
    switch (unit) {
        case "mm": return value;
        case "cm": return value * 10;
        case "in": return value * 25.4;
        case "px": return value * (25.4 / 96); // 96 CSS px per inch
        default:   return value;
    }
}

/**
 * Reads the template's own `@page { size: ... }` rule (if any) so the preview can be
 * sized to match what Puppeteer's preferCSSPageSize will actually print at render
 * time — falls back to A4 landscape, the same default the worker falls back to.
 * Deliberately simple regex parsing, not a full CSS parser — handles the common
 * named formats (A4/Letter, portrait/landscape) and explicit "<num><unit> <num><unit>".
 */
function detectPageSizeMm(html: string): { widthMm: number; heightMm: number } {
    const match = PAGE_SIZE_RULE_RE.exec(html);
    if (!match) return DEFAULT_PAGE_SIZE_MM;

    const raw = match[1]!.trim().toLowerCase();
    if (NAMED_PAGE_SIZES_MM[raw]) return NAMED_PAGE_SIZES_MM[raw];

    const dims = raw.match(/([\d.]+)(mm|cm|in|px)\s+([\d.]+)(mm|cm|in|px)/);
    if (!dims) return DEFAULT_PAGE_SIZE_MM;

    const widthMm  = unitsToMm(parseFloat(dims[1]!), dims[2]!);
    const heightMm = unitsToMm(parseFloat(dims[3]!), dims[4]!);
    if (!widthMm || !heightMm) return DEFAULT_PAGE_SIZE_MM;

    return { widthMm, heightMm };
}

function detectVariables(html: string): { known: string[]; unknown: string[] } {
    const found = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = PLACEHOLDER_RE.exec(html)) !== null) found.add(m[1]!);

    const known:   string[] = [];
    const unknown: string[] = [];
    for (const v of found) {
        (KNOWN_TEMPLATE_VARIABLES as readonly string[]).includes(v) ? known.push(v) : unknown.push(v);
    }
    return { known, unknown };
}

export class CertificateTemplateService {
    constructor(
        private readonly repo: CertificateTemplateRepository,
        private readonly organizationRepo: OrganizationRepository,
    ) { }

    async listTemplates(organizationId: string): Promise<CertificateTemplateListItem[]> {
        const rows = await this.repo.findAllByOrg(organizationId);
        return rows.map(({ htmlContent, ...rest }) => rest);
    }

    async getTemplate(id: string, organizationId: string): Promise<CertificateTemplateResult> {
        const row = await this.repo.findById(id, organizationId);
        if (!row) throw new NotFoundError("Certificate template not found");
        return row;
    }

    async createTemplate(
        organizationId: string,
        name: string,
        htmlContent: string,
        description?: string | null
    ): Promise<{ template: CertificateTemplateResult; unknownPlaceholders: string[] }> {
        const clean = sanitizeHtml(htmlContent);
        const { known, unknown } = detectVariables(clean);

        try {
            const template = await this.repo.create({ organizationId, name, description: description ?? null, htmlContent: clean, variables: known });
            return { template, unknownPlaceholders: unknown };
        } catch (err: any) {
            if (err.code === "P2002") throw new ConflictError(`A template named "${name}" already exists`);
            throw err;
        }
    }

    async updateTemplate(
        id: string,
        organizationId: string,
        input: { name?: string | undefined; description?: string | null | undefined; htmlContent?: string | undefined }
    ): Promise<{ template: CertificateTemplateResult; unknownPlaceholders: string[] }> {
        await this.getTemplate(id, organizationId); // 404 if missing/not owned by this org

        const clean = input.htmlContent !== undefined ? sanitizeHtml(input.htmlContent) : undefined;
        const detected = clean !== undefined ? detectVariables(clean) : undefined;

        try {
            const template = await this.repo.update(id, organizationId, {
                ...(input.name        !== undefined && { name: input.name }),
                ...(input.description !== undefined && { description: input.description }),
                ...(clean              !== undefined && { htmlContent: clean, variables: detected!.known }),
            });
            return { template, unknownPlaceholders: detected?.unknown ?? [] };
        } catch (err: any) {
            if (err.code === "P2002") throw new ConflictError(`A template named "${input.name}" already exists`);
            throw err;
        }
    }

    async deleteTemplate(id: string, organizationId: string): Promise<void> {
        await this.getTemplate(id, organizationId); // 404 if missing
        await this.repo.delete(id, organizationId);
    }

    /**
     * Renders a template — saved (by id) or a draft (raw htmlContent not yet saved) —
     * against realistic dummy data, entirely server-side, no Puppeteer/PDF involved.
     * Returns HTML for the frontend to drop into an <iframe srcDoc>.
     */
    async previewTemplate(
        organizationId: string,
        input: { templateId?: string | undefined; htmlContent?: string | undefined }
    ): Promise<TemplatePreviewResult> {
        let html: string;
        if (input.templateId) {
            html = (await this.getTemplate(input.templateId, organizationId)).htmlContent;
        } else {
            html = sanitizeHtml(input.htmlContent!);
        }

        const [org, timezone] = await Promise.all([
            this.organizationRepo.findById(organizationId),
            this.organizationRepo.findTimezone(organizationId),
        ]);
        const dummyMetadata: CertificateMetadata = {
            participantName: "Jordan Sample",
            contestTitle:    "Sample Contest 2026",
            contestDate:     new Date().toISOString(),
            issuedAt:        new Date().toISOString(),
            score:           87,
            percentage:      87.5,
            rank:            2,
            timeTakenSecs:   1725,
            orgName:         org?.name ?? undefined,
            orgLogoUrl:      org?.logoUrl ?? undefined,
        };

        const rendered = renderCustomTemplateHtml(html, dummyMetadata, "PREVIEW-0000001", timezone);
        const { known, unknown } = detectVariables(html);
        const { widthMm, heightMm } = detectPageSizeMm(html);
        return {
            html: rendered,
            detectedVariables: known,
            unknownPlaceholders: unknown,
            pageWidthMm: widthMm,
            pageHeightMm: heightMm,
        };
    }

    /**
     * Runs a saved template through the REAL certificate-generation pipeline — the same
     * BullMQ queue, certificate.worker.ts, and Puppeteer PDF renderer a real issued
     * certificate uses — with sample/overridable data, so an admin can download an
     * actual PDF and verify true fidelity before issuing anything for real. This also
     * doubles as a health check: if the worker process isn't running or Redis is
     * unreachable, this call times out with a clear error instead of hanging silently.
     *
     * Deliberately does NOT create a Certificate DB row — there's no real
     * participant/contest to attach one to.
     */
    async testGenerate(
        organizationId: string,
        templateId: string,
        overrides: TestGenerateInput
    ): Promise<TestGenerateResult> {
        await this.getTemplate(templateId, organizationId); // 404 if missing/not owned by this org

        const org = await this.organizationRepo.findById(organizationId);
        const testId = crypto.randomUUID();

        const percentage = overrides.percentage ?? 87.5;
        const metadata: CertificateMetadata = {
            participantName: overrides.participantName?.trim() || "Jordan Sample",
            contestTitle:    "Sample Contest 2026",
            contestDate:     new Date().toISOString(),
            issuedAt:        new Date().toISOString(),
            percentage,
            score:           percentage,
            rank:            overrides.rank ?? 2,
            timeTakenSecs:   1725,
            orgName:         org?.name ?? undefined,
            orgLogoUrl:      org?.logoUrl ?? undefined,
        };

        const job = await certificateQueue.add(
            "generate-certificate-test",
            { testId, organizationId, templateId, metadata } satisfies CertificateTestJobPayload,
            { jobId: `test-${testId}` }
        );

        try {
            const result = await job.waitUntilFinished(certificateQueueEvents, 30_000) as TestGenerateResult;

            // The worker's upload (storageService._uploadToS3) hands back a bare,
            // permanent S3 URL — fine for the two genuinely-public prefixes
            // (banners/, ambassador-campaign-poster/), but "certificate-template-tests/"
            // is NOT in the bucket's public-read policy (same as certificates/ and
            // ambassador-proof/), so that bare URL 403s the moment an admin tries to
            // open it. Re-sign it here, mirroring certificate.service.ts's
            // withDownloadUrl() for real certificates.
            try {
                const provider = getStorageProvider();
                const { url } = await provider.getPresignedGetUrl({
                    storageKey: result.key,
                    expiresInSeconds: TEST_CERTIFICATE_DOWNLOAD_URL_TTL_SECONDS,
                });
                return { ...result, url };
            } catch (presignErr) {
                logger.error(`[CertificateTemplateService] Failed to presign test-generate URL for key ${result.key}: ${presignErr}`);
                return result; // fail open to the bare URL rather than breaking the whole response
            }
        } catch (err: any) {
            if (typeof err.message === "string" && err.message.toLowerCase().includes("timed out")) {
                throw new Error(
                    "Test generation timed out after 30s — check that the certificate worker process is running and Redis is reachable."
                );
            }
            throw err;
        }
    }
}
