import { Request, Response, NextFunction } from "express";
import { auditContextStorage } from "../common/audit-context";

/**
 * Seeds the audit ALS context for this request (requestId + ip/ua). Mounted
 * right after addRequestId() in app.ts, before the auth middleware that runs
 * per-route — auth middleware fills in actor fields via setAuditActor() once
 * it resolves who's calling, mutating this same store object.
 */
export function auditContextMiddleware(req: Request, res: Response, next: NextFunction) {
    auditContextStorage.run(
        {
            requestId: req.id,
            ipAddress: req.ip,
            userAgent: req.get("user-agent") ?? undefined,
        },
        next
    );
}
