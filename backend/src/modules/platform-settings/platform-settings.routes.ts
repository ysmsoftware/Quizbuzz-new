import { Router } from "express";
import { opsSettingsAuthMiddleware } from "../../middlewares/ops-settings-auth.middleware";

// Lazy-load the controller, same reasoning as organization.routes.ts / ops-metrics.routes.ts:
// these files are imported by routes.ts -> app.ts, which container.ts also touches, so
// resolving the controller at request time (not module-eval time) avoids a circular-import crash.
function ctrl() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../../container").platformSettingsController;
}

// GET /api/v1/platform/app-logo — public, read by the main app's own frontend (header, etc.)
export const platformSettingsPublicRouter = Router();
platformSettingsPublicRouter.get("/app-logo", (req, res, next) => ctrl().getAppLogo(req, res, next));

// POST/DELETE /api/v1/ops/settings/app-logo — ops-secret protected, called by quizbuzz-ops-next
export const opsSettingsRouter = Router();
opsSettingsRouter.use(opsSettingsAuthMiddleware);
opsSettingsRouter.post("/app-logo", (req, res, next) => ctrl().uploadAppLogo(req, res, next));
opsSettingsRouter.delete("/app-logo", (req, res, next) => ctrl().removeAppLogo(req, res, next));
