import { AuditActorType, AuditTargetType } from "@prisma/client";
import { prisma } from "../config/db";
import { getAuditContext } from "./audit-context";
import { auditLogConfig } from "../config/audit-log.config";
import logger from "../config/logger";

export interface LogAuditInput {
    action: string;
    targetType: AuditTargetType;
    targetId: string;
    targetLabel: string;
    metadata?: Record<string, any> | undefined;
    // Override the ambient AsyncLocalStorage context — needed for SYSTEM/WEBHOOK
    // events where there is no request-scoped actor to inherit.
    organizationId?: string | undefined;
    actorId?: string | undefined;
    actorType?: AuditActorType | undefined;
    actorLabel?: string | undefined;
}

function truncateMetadata(metadata: Record<string, any> | undefined) {
    if (!metadata) return undefined;
    const json = JSON.stringify(metadata);
    if (json.length <= auditLogConfig.metadata.maxBytes) return metadata;
    return { truncated: true, preview: json.slice(0, auditLogConfig.metadata.maxBytes) };
}

/**
 * Records one audit trail entry. Fire-and-forget: never awaited by callers,
 * never throws — a failed write is logged and dropped, it must never affect
 * the caller's actual request/job. Writes straight to this app's own
 * Postgres (audit_logs); ops reads it cross-DB, read-only, separately.
 */
export function logAudit(input: LogAuditInput): void {
    const ctx = getAuditContext();

    const actorType = input.actorType ?? ctx.actorType ?? "SYSTEM";
    const actorLabel = input.actorLabel ?? ctx.actorLabel ?? "SYSTEM";
    const metadata = truncateMetadata(input.metadata);

    prisma.auditLog
        .create({
            data: {
                requestId: ctx.requestId ?? null,
                organizationId: input.organizationId ?? ctx.organizationId ?? null,
                actorId: input.actorId ?? ctx.actorId ?? null,
                actorType,
                actorLabel,
                action: input.action,
                targetType: input.targetType,
                targetId: input.targetId,
                targetLabel: input.targetLabel,
                ...(metadata ? { metadata } : {}),
                ipAddress: ctx.ipAddress ?? null,
                userAgent: ctx.userAgent ?? null,
            },
        })
        .catch((err) => {
            logger.warn(`[audit-log] Failed to write audit entry for action "${input.action}": ${(err as Error).message}`);
        });
}
