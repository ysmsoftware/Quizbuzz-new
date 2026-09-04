import { Request, Response, NextFunction } from "express";
import { PlatformSettingsService } from "./platform-settings.service";

export class PlatformSettingsController {
    constructor(private readonly service: PlatformSettingsService) { }

    // GET /api/v1/platform/app-logo — public
    getAppLogo = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.service.getAppLogo();
            res.json({ success: true, data });
        } catch (err) {
            next(err);
        }
    };

    // POST /api/v1/ops/settings/app-logo — ops-secret protected
    uploadAppLogo = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { fileData, fileName } = req.body;
            const data = await this.service.uploadAppLogo(fileData, fileName);
            res.status(200).json({ success: true, message: "App logo uploaded successfully", data });
        } catch (err) {
            next(err);
        }
    };

    // DELETE /api/v1/ops/settings/app-logo — ops-secret protected
    removeAppLogo = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            await this.service.removeAppLogo();
            res.json({ success: true, message: "App logo removed successfully" });
        } catch (err) {
            next(err);
        }
    };
}
