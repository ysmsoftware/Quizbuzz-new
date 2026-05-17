// src/modules/file/providers/s3.provider.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { FileStorageProvider } from "./storage.provider";
import crypto from "crypto";
import { config } from "../config";

export class S3StorageProvider implements FileStorageProvider {
    private client: S3Client;
    private bucket: string;
    private publicBaseUrl: string;

    constructor() {
        this.client = new S3Client({
            region: config.storage.s3.region!,
            credentials: {
                accessKeyId: config.storage.s3.accessKeyId!,
                secretAccessKey: config.storage.s3.secretKey!,
            },
        });

        this.bucket = config.storage.s3.bucket!;
        this.publicBaseUrl = `https://${this.bucket}.s3.${config.storage.s3.region}.amazonaws.com`;
    }

    async upload(params: {
        buffer: Buffer;
        mimeType: string;
        filename: string;
        folder: string;
    }): Promise<{ url: string; storageKey: string }> {
        const extension = params.filename.split(".").pop();
        const key = `${params.folder}/${crypto.randomUUID()}.${extension}`;

        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: params.buffer,
                ContentType: params.mimeType,

            })
        );

        return {
            storageKey: key,
            url: `${this.publicBaseUrl}/${key}`,
        };
    }

    async delete(storageKey: string): Promise<void> {
        await this.client.send(
            new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: storageKey,
            })
        );
    }
}