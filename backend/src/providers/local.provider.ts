import fs from "fs";
import path from "path";
import crypto from "crypto";
import { FileStorageProvider } from "./storage.provider";
import { config } from "../config";

function validateFolder(folder: string) {
    const parts = folder.split("/");
    // Mirrors S3StorageProvider's allowlist — was previously hardcoded to "proctoring" only,
    // which meant the presigned-URL flow (ambassador-proof, and now ambassador-campaign-poster)
    // would 500 in local/dev mode even though it works fine against real S3.
    const validPrefixes = ["proctoring", "ambassador-proof", "ambassador-campaign-poster"];
    if (parts.length !== 3 || !validPrefixes.includes(parts[0] as string) || !parts[1] || !parts[2]) {
        throw new Error("Access Denied: Invalid folder structure.");
    }
}

export class LocalStorageProvider implements FileStorageProvider {
    private baseDir: string;
    private publicBaseUrl: string;

    constructor() {
        this.baseDir = path.resolve(process.cwd(), "storage");

        this.publicBaseUrl = config.app.baseUrl || `http://localhost:${config.app.port}/storage`;

        if(!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    async upload(params: { buffer: Buffer; mimeType: string; filename: string; folder: string; 

    }): Promise<{ url: string; storageKey: string; }> {
        validateFolder(params.folder);
        const extension = path.extname(params.filename);
        const filename = `${crypto.randomUUID()}${extension}`;

        const folderPath = path.join(this.baseDir, params.folder);
        const filePath = path.join(folderPath, filename);

        // folder exists (event scoped)
        if(!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        await fs.promises.writeFile(filePath, params.buffer);

        const storageKey = `${params.folder}/${filename}`;

        return {
            storageKey,
            url: `${this.publicBaseUrl}/${storageKey}`,
        };
    }

    async delete(storageKey: string): Promise<void> {
        const filePath = path.join(this.baseDir, storageKey);

        if(fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    }

    async getPresignedPutUrl(params: {
        filename: string;
        folder: string;
        mimeType: string;
        expiresInSeconds?: number;
    }): Promise<{ url: string; storageKey: string }> {
        validateFolder(params.folder);
        const extension = params.filename.split(".").pop() || "webp";
        const key = `${params.folder}/${crypto.randomUUID()}.${extension}`;
        
        // Point local-upload back to the express backend
        const appUrl = config.app.baseUrl || `http://localhost:${config.app.port}`;
        const url = `${appUrl}/api/quiz-proctoring/local-upload?key=${encodeURIComponent(key)}`;

        return {
            storageKey: key,
            url,
        };
    }

    async getPresignedGetUrl(params: {
        storageKey: string;
        expiresInSeconds?: number;
    }): Promise<{ url: string }> {
        // Local storage is served as static files — just return the direct URL
        const appUrl = config.app.baseUrl || `http://localhost:${config.app.port}`;
        return { url: `${appUrl}/storage/${params.storageKey}` };
    }
}