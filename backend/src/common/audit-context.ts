import { AsyncLocalStorage } from "node:async_hooks";
import { AuditActorType } from "@prisma/client";

/**
 * Per-request context for the audit trail (see audit-log.ts). Seeded by
 * auditContextMiddleware right after req.id exists; auth middleware mutates
 * the same store object in place once it resolves who the actor is, so
 * logAudit() calls deep in service code never need requestId/actor threaded
 * through every function signature.
 */
export interface AuditContext {
    requestId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    organizationId?: string | undefined;
    actorId?: string | undefined;
    actorLabel?: string | undefined;
    actorType?: AuditActorType | undefined;
}

export const auditContextStorage = new AsyncLocalStorage<AuditContext>();

export function getAuditContext(): AuditContext {
    return auditContextStorage.getStore() ?? {};
}

export function setAuditActor(actor: Pick<AuditContext, "organizationId" | "actorId" | "actorLabel" | "actorType">) {
    Object.assign(getAuditContext(), actor);
}
