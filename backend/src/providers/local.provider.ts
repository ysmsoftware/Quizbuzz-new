import fs from "fs";
import path from "path";
import crypto from "crypto";
import { FileStorageProvider } from "./storage.provider";
import { config } from "../config";

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

}