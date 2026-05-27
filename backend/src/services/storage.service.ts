/**
 * StorageService
 *
 * Single abstraction over all storage backends. The rest of the codebase
 * never imports S3 or fs directly — they call StorageService.
 *
 * Backend is selected at startup from config.storage.provider:
 *   "s3"    → AWS S3 (or any S3-compatible: R2, MinIO)
 *   "local" → local filesystem under /uploads (dev / test only)
 *
 * The public interface returns a { url, key } pair so callers can store
 * both for later deletion or signed-URL generation.
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "../config";
import logger from "../config/logger";

// S3 SDK loaded lazily — only when provider = "s3"
let s3Client: import("@aws-sdk/client-s3").S3Client | null = null;

async function getS3(): Promise<import("@aws-sdk/client-s3").S3Client> {
    if (s3Client) return s3Client;

    const { S3Client } = await import("@aws-sdk/client-s3");

    s3Client = new S3Client({
        region:      config.storage.s3.region ?? "ap-south-1",
        credentials: {
            accessKeyId:     config.storage.s3.accessKeyId!,
            secretAccessKey: config.storage.s3.secretKey!,
        },
    });

    return s3Client;
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface UploadResult {
    /** Publicly accessible URL (S3 URL or local HTTP URL) */
    url: string;
    /** Storage key — use this for deletion or re-generation */
    key: string;
}

export class StorageService {

    /**
     * Upload a Buffer to the configured storage backend.
     *
     * @param key         Storage path, e.g. "certificates/org_abc/cert_xyz.pdf"
     * @param buffer      File content
     * @param contentType MIME type, e.g. "application/pdf"
     * @returns           { url, key }
     */
    async upload(
        key:         string,
        buffer:      Buffer,
        contentType: string
    ): Promise<UploadResult> {
        if (config.storage.provider === "s3") {
            return this._uploadToS3(key, buffer, contentType);
        }
        return this._uploadToLocal(key, buffer);
    }

    /**
     * Delete a file by its storage key.
     * No-op if the file doesn't exist (safe to call on retry).
     */
    async delete(key: string): Promise<void> {
        if (config.storage.provider === "s3") {
            return this._deleteFromS3(key);
        }
        return this._deleteFromLocal(key);
    }

    // ── S3 ────────────────────────────────────────────────────────────────────

    private async _uploadToS3(
        key:         string,
        buffer:      Buffer,
        contentType: string
    ): Promise<UploadResult> {
        const { PutObjectCommand } = await import("@aws-sdk/client-s3");
        const s3 = await getS3();
        const bucket = config.storage.s3.bucket!;

        await s3.send(
            new PutObjectCommand({
                Bucket:      bucket,
                Key:         key,
                Body:        buffer,
                ContentType: contentType,
                // Public reads handled by bucket policy — no ACL needed
            })
        );

        const url = `https://${bucket}.s3.${config.storage.s3.region ?? "ap-south-1"}.amazonaws.com/${key}`;

        logger.info(`[StorageService] S3 upload: ${key}`);
        return { url, key };
    }

    private async _deleteFromS3(key: string): Promise<void> {
        const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        const s3 = await getS3();

        try {
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: config.storage.s3.bucket!,
                    Key:    key,
                })
            );
            logger.info(`[StorageService] S3 delete: ${key}`);
        } catch (err: any) {
            // NoSuchKey is not an error in our context — file may not exist on retry
            if (err.Code !== "NoSuchKey") throw err;
        }
    }

    // ── Local filesystem ──────────────────────────────────────────────────────

    private async _uploadToLocal(key: string, buffer: Buffer): Promise<UploadResult> {
        const uploadDir  = path.resolve(process.cwd(), "uploads");
        const filePath   = path.join(uploadDir, key);
        const fileDir    = path.dirname(filePath);

        // Ensure directory tree exists
        fs.mkdirSync(fileDir, { recursive: true });
        fs.writeFileSync(filePath, buffer);

        // URL served by a static middleware at /uploads/*
        const url = `${config.app.baseUrl}/uploads/${key}`;

        logger.info(`[StorageService] Local upload: ${filePath}`);
        return { url, key };
    }

    private async _deleteFromLocal(key: string): Promise<void> {
        const filePath = path.join(process.cwd(), "uploads", key);
        try {
            fs.unlinkSync(filePath);
            logger.info(`[StorageService] Local delete: ${filePath}`);
        } catch (err: any) {
            if (err.code !== "ENOENT") throw err; // ignore "not found"
        }
    }
}

// ─── Singleton export — used by container and workers ─────────────────────────

export const storageService = new StorageService();
