import { S3StorageProvider } from './s3.provider';
import { LocalStorageProvider } from './local.provider';
import { config } from "../config";

export interface FileStorageProvider {
    upload(params: {
        buffer: Buffer;
        mimeType: string;
        filename: string;
        folder: string;
    }): Promise<{
        url: string;
        storageKey: string;
    }>;

    delete(storageKey: string): Promise<void>;

    getPresignedPutUrl(params: {
        filename: string;
        folder: string;
        mimeType: string;
        expiresInSeconds?: number;
    }): Promise<{
        url: string;
        storageKey: string;
    }>;

    getPresignedGetUrl(params: {
        storageKey: string;
        expiresInSeconds?: number;
    }): Promise<{ url: string }>;
}


export function getStorageProvider(): FileStorageProvider {

    const driver = config.storage.provider || "local";

    switch (driver) {
        case "s3":
            return new S3StorageProvider();
        case "local":
        default:
            return new LocalStorageProvider();
    }
}