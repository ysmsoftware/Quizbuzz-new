import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FileStorageProvider } from "./storage.provider";
import crypto from "crypto";
import { config } from "../config";

function validateFolder(folder: string) {
    const parts = folder.split("/");
    if (parts.length !== 3 || parts[0] !== "proctoring" || !parts[1] || !parts[2]) {
        throw new Error("Access Denied: Invalid folder structure. Expected 'proctoring/{contestSlug}/{participantSlug}'");
    }
}

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
        validateFolder(params.folder);
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

    async getPresignedPutUrl(params: {
        filename: string;
        folder: string;
        mimeType: string;
        expiresInSeconds?: number;
    }): Promise<{ url: string; storageKey: string }> {
        validateFolder(params.folder);
        const extension = params.filename.split(".").pop() || "webp";
        const key = `${params.folder}/${crypto.randomUUID()}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: params.mimeType,
        });

        const url = await getSignedUrl(this.client, command, {
            expiresIn: params.expiresInSeconds || 300,
        });

        return {
            storageKey: key,
            url,
        };
    }
    async getPresignedGetUrl(params: {
        storageKey: string;
        expiresInSeconds?: number;
    }): Promise<{ url: string }> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: params.storageKey,
        });

        const url = await getSignedUrl(this.client, command, {
            expiresIn: params.expiresInSeconds || 3600,
        });

        return { url };
    }
}