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
import { certificateService } from "../container";
import { storageService } from "../services/storage.service";
import { CertificateJobPayload, CertificateMetadata } from "../modules/certificate/certificate.types";
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
    browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",                    // required in Docker / Linux
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",         // use /tmp instead of /dev/shm (Docker)
            "--disable-gpu",
            "--font-render-hinting=none",      // consistent font rendering
        ],
    });

    browser.on("disconnected", () => {
        logger.warn("[certificate-worker] Browser disconnected — will relaunch on next job");
        browser = null;
    });

    return browser;
}

// ─── HTML template rendering ──────────────────────────────────────────────────

/**
 * Renders the certificate HTML from the metadata.
 *
 * In production this function would load a template from:
 *   - A contest-specific template in S3/DB (keyed by metadata.templateId)
 *   - A default fallback template
 *
 * For now it produces a clean, self-contained HTML string that Puppeteer
 * can render without any network requests (all styles are inline).
 *
 * The HTML uses A4 landscape dimensions (297mm × 210mm).
 */
function renderCertificateHtml(meta: CertificateMetadata): string {
    const issuedDate = new Date(meta.issuedAt).toLocaleDateString("en-IN", {
        day:   "2-digit",
        month: "long",
        year:  "numeric",
    });

    const scoreLine = meta.percentage !== undefined
        ? `<p class="score">Score: <strong>${meta.percentage.toFixed(2)}%</strong>${
            meta.rank ? ` &nbsp;|&nbsp; Rank: <strong>#${meta.rank}</strong>` : ""
          }</p>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    @page { size: A4 landscape; margin: 0; }

    body {
      width: 297mm;
      height: 210mm;
      font-family: "Georgia", serif;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cert {
      width: 270mm;
      height: 185mm;
      border: 8px double #1a3a6b;
      padding: 32px 48px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 16px;
    }

    .org-logo { font-size: 13px; color: #777; text-transform: uppercase; letter-spacing: 3px; }
    .title    { font-size: 36px; font-weight: bold; color: #1a3a6b; letter-spacing: 1px; }
    .subtitle { font-size: 14px; color: #555; }
    .name     { font-size: 28px; font-weight: bold; color: #222; border-bottom: 2px solid #1a3a6b; padding-bottom: 8px; min-width: 200px; }
    .body     { font-size: 15px; color: #444; max-width: 420px; line-height: 1.7; }
    .contest  { font-size: 18px; font-weight: bold; color: #1a3a6b; }
    .score    { font-size: 14px; color: #555; }
    .footer   { font-size: 12px; color: #999; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="cert">
    <p class="org-logo">QuizBuzz</p>
    <h1 class="title">Certificate of Achievement</h1>
    <p class="subtitle">This is to certify that</p>
    <p class="name">${escapeHtml(meta.participantName)}</p>
    <p class="body">
      has successfully participated in and completed the
    </p>
    <p class="contest">${escapeHtml(meta.contestTitle)}</p>
    ${scoreLine}
    <p class="footer">Issued on ${issuedDate}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function generatePdf(html: string): Promise<Buffer> {
    const b    = await getBrowser();
    const page = await b.newPage();

    try {
        await page.setContent(html, { waitUntil: "networkidle0" });

        const pdf = await page.pdf({
            format:          "A4",
            landscape:       true,
            printBackground: true,
            margin:          { top: "0", right: "0", bottom: "0", left: "0" },
        });

        return Buffer.from(pdf);
    } finally {
        await page.close();
    }
}

// ─── Worker processor ─────────────────────────────────────────────────────────

async function processCertificate(job: Job<CertificateJobPayload>): Promise<void> {
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

    const html = renderCertificateHtml(metadata);

    // ── Step 4: Generate PDF via Puppeteer ────────────────────────────────────

    let pdfBuffer: Buffer;
    try {
        pdfBuffer = await generatePdf(html);
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
    private worker?: BullMQWorker<CertificateJobPayload>;

    start() {
        // Certificate generation is CPU + memory intensive — use a lower concurrency
        // than submission/evaluation workers. Each Puppeteer page takes ~50-100MB.
        const CERT_CONCURRENCY = Math.max(
            1,
            Math.floor(config.queue.concurrency / 4)
        );

        this.worker = new BullMQWorker<CertificateJobPayload>(
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

            // Mark the DB row as FAILED so admin can see it and trigger a retry
            if (job?.data?.certificateId) {
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
