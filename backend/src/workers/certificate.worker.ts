/**
 * Certificate Worker
 *
 * Responsibility:
 *   1. Dequeue a CertificateJobPayload
 *   2. Mark the DB row as GENERATING
 *   3. Render the HTML certificate template with the participant's data
 *   4. Generate a PDF via Puppeteer (headless Chromium)
 *   5. Upload the PDF to the configured storage backend (S3 or local)
 *   6. Mark the DB row as GENERATED with the fileUrl + fileKey
 *   7. On any failure → mark as FAILED with reason
 *
 * Standalone process:
 *   node dist/workers/certificate.worker.js
 *
 * Puppeteer is CPU + memory intensive. Scale this worker separately from
 * the submission and evaluation workers — it needs more RAM per instance.
 * Set WORKER_INSTANCES for this pool independently in your process manager.
 */

import { Worker as BullMQWorker, Job, UnrecoverableError } from "bullmq";
import puppeteer, { Browser } from "puppeteer";
import { redis } from "../config/redis";
import { config } from "../config";
import { certificateService, certificateTemplateService, organizationRepository } from "../container";
import { storageService } from "../services/storage.service";
import { CertificateJobPayload, CertificateTestJobPayload } from "../modules/certificate/certificate.types";
import { CertificateQueueJobData } from "../queues";
import { renderCertificateHtml, renderCustomTemplateHtml } from "../modules/certificate/certificate.template";
import logger from "../config/logger";
import { workerRegistry } from "./worker.registry";
import { Worker } from "./worker.interface";

// ─── Browser lifecycle ────────────────────────────────────────────────────────
// One browser instance is shared across all concurrent jobs in this process.
// Launching a new browser per job takes ~1-2s and wastes RAM.
// The browser is lazy-launched on the first job and restarted on crash.

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (browser && browser.connected) return browser;

    logger.info("[certificate-worker] Launching Puppeteer browser...");
    const launchOptions: any = {
        headless: true,
        args: [
            "--no-sandbox",                    // required in Docker / Linux
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",         // use /tmp instead of /dev/shm (Docker)
            "--disable-gpu",
            "--font-render-hinting=none",      // consistent font rendering
        ],
    };

    if (config.puppeteer.executablePath) {
        launchOptions.executablePath = config.puppeteer.executablePath;
    }

    browser = await puppeteer.launch(launchOptions);

    browser.on("disconnected", () => {
        logger.warn("[certificate-worker] Browser disconnected — will relaunch on next job");
        browser = null;
    });

    return browser;
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function generatePdf(html: string, disableScripts: boolean = false): Promise<Buffer> {
    const b    = await getBrowser();
    const page = await b.newPage();

    try {
        if (disableScripts) await page.setJavaScriptEnabled(false);
        await page.setContent(html, { waitUntil: "load" });

        const pdf = await page.pdf({
            // format/landscape below are the FALLBACK only — preferCSSPageSize means
            // any `@page { size: ... }` declared in the HTML's own CSS wins instead.
            // The built-in templates already declare `@page { size: A4 landscape; margin: 0; }`
            // (see certificate.template.ts), so this is a no-op for them — byte-identical
            // output. For admin-uploaded custom templates, this is what stops their layout
            // from being silently forced into A4 landscape if they designed for a different
            // canvas size.
            format:            "A4",
            landscape:         true,
            preferCSSPageSize: true,
            printBackground:   true,
            margin:            { top: "0", right: "0", bottom: "0", left: "0" },
        });

        return Buffer.from(pdf);
    } finally {
        await page.close();
    }
}

// ─── Worker processor ─────────────────────────────────────────────────────────

/**
 * Single entry point for the "certificate-queue" — dispatches to the real-certificate
 * path or the test-generation path based on job name, since both share the same queue,
 * worker process, and Puppeteer browser instance.
 */
async function processCertificate(job: Job<CertificateQueueJobData>): Promise<{ url: string; key: string } | void> {
    if (job.name === "generate-certificate-test") {
        return processTestCertificate(job as Job<CertificateTestJobPayload>);
    }
    return processRealCertificate(job as Job<CertificateJobPayload>);
}

/**
 * One-off "Test Generate PDF" job triggered by an admin from the template library
 * (CertificateTemplateService.testGenerate). Runs the exact same render → PDF →
 * upload steps as a real certificate, but there is no Certificate DB row to update —
 * no real participant/contest exists for it — so markGenerating/markGenerated/
 * markFailed are all deliberately skipped here. The job's return value (resolved via
 * BullMQ's Job.waitUntilFinished on the caller's side) is the download URL.
 */
async function processTestCertificate(
    job: Job<CertificateTestJobPayload>
): Promise<{ url: string; key: string }> {
    const { testId, organizationId, templateId, metadata } = job.data;

    if (!testId || !organizationId || !templateId || !metadata?.participantName) {
        throw new UnrecoverableError(
            `[certificate-worker] Invalid test payload: testId=${testId} template=${templateId}`
        );
    }

    logger.info(`[certificate-worker] Test job ${job.id} started — template: ${templateId}`);

    const [template, timezone] = await Promise.all([
        certificateTemplateService.getTemplate(templateId, organizationId),
        organizationRepository.findTimezone(organizationId),
    ]);
    const html = renderCustomTemplateHtml(template.htmlContent, metadata, `TEST-${testId}`, timezone);

    let pdfBuffer: Buffer;
    try {
        // Test-generated PDFs always come from a custom template — same JS-disabled
        // rendering path a real custom-template certificate would use.
        pdfBuffer = await generatePdf(html, true);
    } catch (err: any) {
        throw new Error(`[certificate-worker] Test PDF generation failed for template ${templateId}: ${err.message}`);
    }

    const storageKey = `certificate-template-tests/${organizationId}/${templateId}/${testId}.pdf`;
    const uploadResult = await storageService.upload(storageKey, pdfBuffer, "application/pdf");

    logger.info(`[certificate-worker] Test job ${job.id} complete — uploaded to ${uploadResult.url}`);
    return uploadResult;
}

async function processRealCertificate(job: Job<CertificateJobPayload>): Promise<void> {
    const { certificateId, organizationId, contestId, participantId, metadata } = job.data;

    logger.info(
        `[certificate-worker] Job ${job.id} started — cert: ${certificateId} participant: ${participantId} attempt: ${job.attemptsMade + 1}/${config.queue.retryAttempts}`
    );

    // ── Step 1: Validate payload ──────────────────────────────────────────────

    if (!certificateId || !organizationId || !contestId || !participantId) {
        throw new UnrecoverableError(
            `[certificate-worker] Invalid payload: missing required IDs. cert=${certificateId}`
        );
    }

    if (!metadata?.participantName || !metadata?.contestTitle) {
        throw new UnrecoverableError(
            `[certificate-worker] Missing metadata fields for cert ${certificateId}`
        );
    }

    // ── Step 2: Mark as GENERATING ────────────────────────────────────────────

    await certificateService.markGenerating(certificateId, organizationId);

    // ── Step 3: Render HTML ───────────────────────────────────────────────────
    // Dates on the certificate (contest date, issued date) are formatted in the
    // organization's own configured timezone — see utils/timezone.ts — rather than
    // implicitly using this worker process's local time.
    const timezone = await organizationRepository.findTimezone(organizationId);

    let html: string;
    let usesCustomTemplate = false;

    if (metadata.templateId) {
        const template = await certificateTemplateService.getTemplate(metadata.templateId, organizationId);
        html = renderCustomTemplateHtml(template.htmlContent, metadata, certificateId, timezone);
        usesCustomTemplate = true;
    } else {
        html = renderCertificateHtml(metadata, certificateId, timezone);
    }

    // ── Step 4: Generate PDF via Puppeteer ────────────────────────────────────

    let pdfBuffer: Buffer;
    try {
        pdfBuffer = await generatePdf(html, usesCustomTemplate);
    } catch (err: any) {
        // Puppeteer errors (browser crash, render timeout) are retryable
        throw new Error(`[certificate-worker] PDF generation failed for cert ${certificateId}: ${err.message}`);
    }

    logger.info(
        `[certificate-worker] Job ${job.id} — PDF generated (${pdfBuffer.byteLength} bytes)`
    );

    // ── Step 5: Upload to storage ─────────────────────────────────────────────

    const storageKey = `certificates/${organizationId}/${contestId}/${certificateId}.pdf`;

    let uploadResult: { url: string; key: string };
    try {
        uploadResult = await storageService.upload(storageKey, pdfBuffer, "application/pdf");
    } catch (err: any) {
        // Storage errors are retryable — S3 may be briefly unavailable
        throw new Error(`[certificate-worker] Upload failed for cert ${certificateId}: ${err.message}`);
    }

    logger.info(
        `[certificate-worker] Job ${job.id} — uploaded to ${uploadResult.url}`
    );

    // ── Step 6: Mark as GENERATED ─────────────────────────────────────────────

    await certificateService.markGenerated(
        certificateId,
        organizationId,
        uploadResult.url,
        uploadResult.key
    );

    logger.info(
        `[certificate-worker] Job ${job.id} complete — cert ${certificateId} GENERATED`
    );
}

// ─── Worker registration ──────────────────────────────────────────────────────

export class CertificateWorker implements Worker {
    name = "certificate-worker";
    private worker?: BullMQWorker<CertificateQueueJobData>;

    start() {
        // Certificate generation is CPU + memory intensive — use a lower concurrency
        // than submission/evaluation workers. Each Puppeteer page takes ~50-100MB.
        const CERT_CONCURRENCY = Math.max(
            1,
            Math.floor(config.queue.concurrency / 4)
        );

        this.worker = new BullMQWorker<CertificateQueueJobData>(
            "certificate-queue",
            processCertificate,
            {
                connection:  redis,
                prefix:      config.queue.prefix,
                concurrency: CERT_CONCURRENCY,
            }
        );

        // ─── Worker lifecycle events ──────────────────────────────────────────────────

        this.worker.on("completed", (job) => {
            logger.info(`[certificate-worker] Job ${job.id} completed`);
        });

        this.worker.on("failed", async (job, err) => {
            const permanent = err instanceof UnrecoverableError;

            logger.error(
                `[certificate-worker] Job ${job?.id} failed (${permanent ? "permanent" : `attempt ${job?.attemptsMade}`}): ${err.message}`
            );

            // Mark the DB row as FAILED so admin can see it and trigger a retry.
            // Test-generation jobs have no `certificateId` (no Certificate DB row exists
            // for them) — this guard naturally skips them, nothing else needed.
            if (job?.data && "certificateId" in job.data && job.data.certificateId) {
                try {
                    await certificateService.markFailed(
                        job.data.certificateId,
                        job.data.organizationId,
                        err.message
                    );
                } catch (markErr: any) {
                    logger.error(
                        `[certificate-worker] Could not mark cert ${job.data.certificateId} as FAILED: ${markErr.message}`
                    );
                }
            }
        });

        this.worker.on("error", (err) => {
            logger.error(`[certificate-worker] Worker error: ${err.message}`);
        });

        this.worker.on("ready", () => {
            logger.info(
                `[certificate-worker] Ready — concurrency: ${CERT_CONCURRENCY} prefix: ${config.queue.prefix}`
            );
        });

        // ─── Graceful shutdown ────────────────────────────────────────────────────────

        const shutdown = async (signal: string): Promise<void> => {
            logger.info(`[certificate-worker] ${signal} received — draining…`);
            if (this.worker) await this.worker.close();

            if (browser) {
                await browser.close();
                logger.info("[certificate-worker] Puppeteer browser closed");
            }

            logger.info("[certificate-worker] Shutdown complete");
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT",  () => shutdown("SIGINT"));
    }
}

const certificateWorkerInstance = new CertificateWorker();
workerRegistry.register(certificateWorkerInstance);
