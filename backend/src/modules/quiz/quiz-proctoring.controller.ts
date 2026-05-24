import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { getStorageProvider } from "../../providers/storage.provider";
import logger from "../../config/logger";
import { captureMetadataQueue, CaptureMetadataJobPayload } from "../../queues";
import { ViolationType } from "@prisma/client";

const PresignedUrlSchema = z.object({
    filename: z.string().min(1, "filename is required"),
    folder: z.string().min(1, "folder is required"),
    mimeType: z.string().min(1, "mimeType is required"),
});

const ConfirmUploadSchema = z.object({
    type: z.nativeEnum(ViolationType),
    storageKey: z.string().optional(),
    severity: z.number().int().min(1).max(3).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    occurredAt: z.string().optional(),
});

export class QuizProctoringController {
    /**
     * POST /quiz-proctoring/presigned-url
     * Returns a presigned S3 URL or a local upload route depending on storage configuration.
     */
    getPresignedUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { filename, folder, mimeType } = PresignedUrlSchema.parse(req.body);
            const provider = getStorageProvider();
            
            const result = await provider.getPresignedPutUrl({
                filename,
                folder,
                mimeType,
                expiresInSeconds: 300,
            });

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            logger.error(`[QuizProctoringController] Failed to generate presigned URL: ${error}`);
            next(error);
        }
    };

    /**
     * PUT /quiz-proctoring/local-upload
     * Receives raw binary stream and writes to the local uploads directory.
     * Used when config.storage.provider === "local".
     */
    localUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const storageKey = req.query.key as string;
            if (!storageKey) {
                res.status(400).json({ success: false, message: "Missing 'key' query parameter." });
                return;
            }

            const baseDir = path.resolve(process.cwd(), "storage");
            const filePath = path.join(baseDir, storageKey);

            // Enforce proctoring prefix to prevent arbitrary file upload outside proctoring context
            if (!storageKey.startsWith("proctoring/")) {
                res.status(403).json({ success: false, message: "Access Denied: Invalid upload path." });
                return;
            }

            // Prevent path traversal
            if (!filePath.startsWith(baseDir)) {
                res.status(403).json({ success: false, message: "Access Denied: Path traversal detected." });
                return;
            }

            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
            }

            const writeStream = fs.createWriteStream(filePath);
            req.pipe(writeStream);

            writeStream.on("finish", () => {
                res.status(200).json({ success: true });
            });

            writeStream.on("error", (err) => {
                logger.error(`[QuizProctoringController] Local upload write stream error: ${err}`);
                next(err);
            });
        } catch (error) {
            logger.error(`[QuizProctoringController] Failed local upload: ${error}`);
            next(error);
        }
    };

    /**
     * POST /quiz-proctoring/confirm
     * Confirms the upload of a proctoring snapshot or client violation event.
     * Enqueues the event data to BullMQ captureMetadataQueue for asynchronous, non-blocking DB/Redis persistence.
     */
    confirmUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const participant = req.participant;
            if (!participant) {
                res.status(401).json({ success: false, message: "Unauthorized participant context" });
                return;
            }

            const { type, storageKey, severity, metadata, occurredAt } = ConfirmUploadSchema.parse(req.body);

            const payload: CaptureMetadataJobPayload = {
                participantId: participant.id,
                contestId: participant.contestId,
                organizationId: participant.organizationId,
                type,
            };

            if (storageKey !== undefined) payload.storageKey = storageKey;
            if (severity !== undefined) payload.severity = severity;
            if (metadata !== undefined) payload.metadata = metadata || {};
            if (occurredAt !== undefined) payload.occurredAt = occurredAt;

            // Enqueue onto BullMQ to allow non-blocking instant response (<10ms target latency)
            await captureMetadataQueue.add("process-metadata", payload);

            res.status(200).json({
                success: true,
                message: "Event confirmation accepted.",
            });
        } catch (error) {
            logger.error(`[QuizProctoringController] Failed to confirm upload: ${error}`);
            next(error);
        }
    };
}

export const quizProctoringController = new QuizProctoringController();
