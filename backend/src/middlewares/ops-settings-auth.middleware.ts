import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { UnauthorizedError } from "../error/http-errors";

/**
 * Guards the mutating /ops/settings/* routes (e.g. replacing/removing the
 * platform app logo) the same way ops-metrics-auth.middleware.ts guards
 * /ops/metrics/* — a shared secret presented by quizbuzz-ops-next, since it
 * has no participant/org session to present here. Checked via the
 * `x-ops-settings-secret` header, not a query param, so it never ends up
 * logged in access logs or browser history.
 */
export const opsSettingsAuthMiddleware = (req: Request, _res: Response, next: NextFunction) => {
    const provided = req.headers["x-ops-settings-secret"];
    if (typeof provided !== "string" || provided.length === 0 || provided !== config.opsSettings.secret) {
        throw new UnauthorizedError("Invalid or missing ops settings secret");
    }
    next();
};
