import { prisma } from "../../config/db";
import { PlatformAppSettings } from "@prisma/client";

const SETTINGS_ID = "app_settings_default";

export class PlatformSettingsRepository {
    async get(): Promise<PlatformAppSettings | null> {
        return prisma.platformAppSettings.findUnique({ where: { id: SETTINGS_ID } });
    }

    async setAppLogo(appLogoUrl: string, appLogoKey: string): Promise<PlatformAppSettings> {
        return prisma.platformAppSettings.upsert({
            where: { id: SETTINGS_ID },
            create: { id: SETTINGS_ID, appLogoUrl, appLogoKey },
            update: { appLogoUrl, appLogoKey },
        });
    }

    async clearAppLogo(): Promise<PlatformAppSettings> {
        return prisma.platformAppSettings.upsert({
            where: { id: SETTINGS_ID },
            create: { id: SETTINGS_ID, appLogoUrl: null, appLogoKey: null },
            update: { appLogoUrl: null, appLogoKey: null },
        });
    }
}
