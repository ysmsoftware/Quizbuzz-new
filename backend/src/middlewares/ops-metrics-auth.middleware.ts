import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { UnauthorizedError } from "../error/http-errors";

/**
 * Guards the /ops/metrics/* routes. These expose live process/Redis internals
 * (heap usage, active WS connection counts, per-contest participant state) to
 * the operational dashboard (quizbuzz-ops-next) over the public internet, so
 * they're gated behind a shared secret rather than the normal admin-org JWT —
 * the ops dashboard has no participant/org session to present here, just a
 * server-to-server credential, the same pattern BILLING_HANDOFF_SECRET already
 * uses for the ops app's other main-app touchpoints.
 *
 * Checked via the `x-ops-metrics-secret` header, not a query param, so it
 * never ends up logged in access logs or browser history.
 */
export const opsMetricsAuthMiddleware = (req: Request, _res: Response, next: NextFunction) => {
    const provided = req.headers["x-ops-metrics-secret"];
    if (typeof provided !== "string" || provided.length === 0 || provided !== config.opsMetrics.secret) {
        throw new UnauthorizedError("Invalid or missing ops metrics secret");
    }
    next();
};
