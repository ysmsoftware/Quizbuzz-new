import { Request, Response, NextFunction } from "express";
import { isFeatureEnabled } from "../common/feature-flags";

/**
 * Platform-wide kill switch, driven by the `maintenance_mode` flag
 * (quizbuzz-ops-next's FeatureFlagsView.tsx). Org-unaware by design —
 * maintenance_mode has supportsOrgOverride: false, "maintenance for one org"
 * isn't a coherent concept.
 *
 * Mounted only on the `/api/v1` router (see app.ts), so /health, /metrics,
 * and the Razorpay webhook route (registered earlier, before body parsing)
 * are never gated — no allowlist needed since those paths simply aren't
 * under this mount point.
 */
export async function maintenanceGate(req: Request, res: Response, next: NextFunction) {
    if (await isFeatureEnabled("maintenance_mode")) {
        return res.status(503).set("Retry-After", "300").json({
            success: false,
            code: "MAINTENANCE_MODE",
            message: "The platform is temporarily under maintenance. Please try again shortly.",
        });
    }
    next();
}
