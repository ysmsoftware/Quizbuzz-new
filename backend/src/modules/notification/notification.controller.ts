import { Request, Response, NextFunction } from "express";
import { NotificationService } from "./notification.service";
import { updateNotificationPreferencesSchema } from "./notification.validator";
import { BadRequestError } from "../../error/http-errors";

export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    // GET /organizations/:orgId/notification-preferences
    getPreferences = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.notificationService.getPreferences(req.params.orgId as string, req.user!.id);
            res.json({ success: true, data });
        } catch (err) {
            next(err);
        }
    };

    // PUT /organizations/:orgId/notification-preferences
    updatePreferences = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = updateNotificationPreferencesSchema.safeParse(req.body);
            if (!parsed.success) throw new BadRequestError(parsed.error.issues[0]?.message || "Validation failed");
            const data = await this.notificationService.updatePreferences(
                req.params.orgId as string,
                req.user!.id,
                parsed.data.preferences,
            );
            res.json({ success: true, data });
        } catch (err) {
            next(err);
        }
    };
}
