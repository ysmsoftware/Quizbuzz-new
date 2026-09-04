import { PlatformSettingsRepository } from "./platform-settings.repository";
import { storageService } from "../../services/storage.service";
import { PlatformAppLogoResult } from "./platform-settings.types";
import { BadRequestError } from "../../error/http-errors";

export class PlatformSettingsService {
    constructor(private readonly repo: PlatformSettingsRepository) { }

    async getAppLogo(): Promise<PlatformAppLogoResult> {
        const settings = await this.repo.get();
        return { appLogoUrl: settings?.appLogoUrl ?? null };
    }

    async uploadAppLogo(fileData: string, fileName: string): Promise<PlatformAppLogoResult> {
        if (!fileData || !fileName) {
            throw new BadRequestError("File data and file name are required.");
        }

        const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let buffer: Buffer;
        let contentType: string;

        if (matches && matches.length === 3) {
            contentType = matches[1]!;
            buffer = Buffer.from(matches[2]!, "base64");
        } else {
            contentType = "image/png";
            buffer = Buffer.from(fileData, "base64");
        }

        const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const key = `app-settings/logo/${Date.now()}_${cleanFileName}`;

        const existing = await this.repo.get();
        const uploadResult = await storageService.upload(key, buffer, contentType);

        if (existing?.appLogoKey) {
            await storageService.delete(existing.appLogoKey).catch(() => {
                // best-effort cleanup — a stray orphaned object isn't worth failing the request over
            });
        }

        const settings = await this.repo.setAppLogo(uploadResult.url, uploadResult.key);
        return { appLogoUrl: settings.appLogoUrl };
    }

    async removeAppLogo(): Promise<void> {
        const existing = await this.repo.get();
        if (existing?.appLogoKey) {
            await storageService.delete(existing.appLogoKey).catch(() => {
                // best-effort cleanup — a stray orphaned object isn't worth failing the request over
            });
        }
        await this.repo.clearAppLogo();
    }
}
