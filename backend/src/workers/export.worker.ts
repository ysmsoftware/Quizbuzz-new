import { Worker as BullWorker, Job } from "bullmq";
import { redis } from "../config/redis";
import { config } from "../config";
import logger from "../config/logger";
import { prisma } from "../config/db";
import { exportQueue, ExportJobPayload } from "../queues";
import { storageService } from "../services/storage.service";
import * as Sentry from "@sentry/node";
import { workerRegistry } from "./worker.registry";
import puppeteer from "puppeteer";

export class ExportWorker {
    public readonly name = "ExportWorker";
    private worker: BullWorker<ExportJobPayload> | null = null;

    start() {
        this.worker = new BullWorker<ExportJobPayload>(
            exportQueue.name,
            async (job: Job<ExportJobPayload>) => {
                await this.processExport(job);
            },
            {
                connection: redis,
                prefix: config.queue.prefix,
                concurrency: 2,
            }
        );

        this.worker.on("completed", (job) => {
            logger.info(`[ExportWorker] Job ${job.id} completed for exportId ${job.data.exportId}`);
        });

        this.worker.on("failed", (job, err) => {
            logger.error(`[ExportWorker] Job ${job?.id} failed:`, err);
            Sentry.captureException(err, { tags: { queue: exportQueue.name } });
        });
    }

    private async processExport(job: Job<ExportJobPayload>) {
        const { exportId } = job.data;
        const exportLog = await prisma.exportLog.findUnique({
            where: { id: exportId },
            include: { contest: true, organization: true }
        });

        if (!exportLog) {
            logger.warn(`[ExportWorker] ExportLog not found: ${exportId}`);
            return;
        }

        try {
            await prisma.exportLog.update({
                where: { id: exportId },
                data: { status: "PROCESSING", progress: 10 }
            });

            const filters = exportLog.filters as any || {};

            // Build Prisma Where Clause based on typical registration filters
            const whereClause: any = { contestId: exportLog.contestId };
            if (filters.status) {
                whereClause.status = filters.status;
            }
            if (filters.search) {
                whereClause.OR = [
                    { registrationRef: { contains: filters.search, mode: 'insensitive' } },
                    { contact: { email: { contains: filters.search, mode: 'insensitive' } } },
                    { contact: { firstName: { contains: filters.search, mode: 'insensitive' } } }
                ];
            }

            const participants = await prisma.participant.findMany({
                where: whereClause,
                include: { contact: true },
                orderBy: { createdAt: 'desc' }
            });

            await prisma.exportLog.update({
                where: { id: exportId },
                data: { progress: 40 }
            });

            let buffer: Buffer;
            let contentType: string;
            let fileExt: string;

            if (exportLog.format === "csv") {
                buffer = this.generateCSV(participants);
                contentType = "text/csv";
                fileExt = "csv";
            } else if (exportLog.format === "pdf") {
                buffer = await this.generatePDF(participants, exportLog.contest.title);
                contentType = "application/pdf";
                fileExt = "pdf";
            } else {
                throw new Error("Unsupported format");
            }

            await prisma.exportLog.update({
                where: { id: exportId },
                data: { progress: 80 }
            });

            const safeTitle = exportLog.contest.title.replace(/[^a-zA-Z0-9]/g, "_");
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `${safeTitle}_${timestamp}.${fileExt}`;
            const storageKey = `exports/${exportLog.organizationId}/${exportLog.contestId}/${fileName}`;

            const uploadResult = await storageService.upload(storageKey, buffer, contentType);

            await prisma.exportLog.update({
                where: { id: exportId },
                data: {
                    status: "COMPLETED",
                    progress: 100,
                    fileUrl: uploadResult.url,
                    fileKey: uploadResult.key
                }
            });

        } catch (error: any) {
            await prisma.exportLog.update({
                where: { id: exportId },
                data: {
                    status: "FAILED",
                    error: error.message || "Unknown error occurred"
                }
            });
            throw error;
        }
    }

    private generateCSV(participants: any[]): Buffer {
        if (participants.length === 0) {
            return Buffer.from("No data available\n");
        }
        
        const rows = participants.map(p => ({
            "Registration ID": p.registrationRef,
            "Name": `${p.contact.firstName} ${p.contact.lastName || ''}`.trim(),
            "Email": p.contact.email,
            "Phone": p.contact.phone || '',
            "Status": p.status,
            "Joined At": p.joinedAt ? new Date(p.joinedAt).toISOString() : '',
            "Checked In At": p.checkedInAt ? new Date(p.checkedInAt).toISOString() : ''
        }));

        const firstRow = rows[0];
        if (!firstRow) return Buffer.from('', 'utf-8');

        const header = Object.keys(firstRow).join(',');
        const csvContent = [
            header,
            ...rows.map(r => Object.values(r).map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        return Buffer.from(csvContent, 'utf-8');
    }

    private async generatePDF(participants: any[], contestTitle: string): Promise<Buffer> {
        let html = `
        <html>
        <head>
            <style>
                body { font-family: sans-serif; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                h1 { font-size: 18px; }
            </style>
        </head>
        <body>
            <h1>Exported Registrations for: ${contestTitle}</h1>
            <p>Generated on: ${new Date().toISOString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>Registration ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Joined At</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const p of participants) {
            const name = `${p.contact.firstName} ${p.contact.lastName || ''}`.trim();
            html += `
                <tr>
                    <td>${p.registrationRef}</td>
                    <td>${name}</td>
                    <td>${p.contact.email}</td>
                    <td>${p.status}</td>
                    <td>${p.joinedAt ? new Date(p.joinedAt).toLocaleString() : '-'}</td>
                </tr>
            `;
        }

        html += `
                </tbody>
            </table>
        </body>
        </html>
        `;

        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        return Buffer.from(pdfBuffer);
    }
}

workerRegistry.register(new ExportWorker());
