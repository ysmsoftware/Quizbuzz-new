import { prisma } from "../config/db";

/**
 * Org-aware read SDK for quizbuzz-ops-next's AmbassadorType catalog, mirrored
 * into this app's own database via a write-through on every type create/edit/
 * toggle (same mechanism as platform_feature_flags — see
 * src/common/feature-flags.ts). This module only ever reads — ops-next is the
 * single source of truth for what's written into these two tables.
 */

export type ApplicationFieldType = "TEXT" | "EMAIL" | "PHONE" | "NUMBER" | "SELECT" | "DATE";

export interface ApplicationFieldDef {
    key: string;
    label: string;
    type: ApplicationFieldType;
    required: boolean;
    options?: string[]; // only meaningful when type === "SELECT"
}

export interface AmbassadorTypeDefinition {
    key: string;
    label: string;
    proofFieldLabel: string;
    applicationFields: ApplicationFieldDef[];
}

const CACHE_TTL_MS = 60_000;
const enabledTypesCache = new Map<string, { value: AmbassadorTypeDefinition[]; expires: number }>();

export async function getEnabledAmbassadorTypes(organizationId: string): Promise<AmbassadorTypeDefinition[]> {
    const cached = enabledTypesCache.get(organizationId);
    if (cached && cached.expires > Date.now()) return cached.value;

    try {
        const accessRows = await prisma.organizationAmbassadorTypeAccess.findMany({
            where: { organizationId, isEnabled: true },
            select: { typeKey: true },
        });
        const enabledKeys = accessRows.map((r) => r.typeKey);
        if (enabledKeys.length === 0) {
            enabledTypesCache.set(organizationId, { value: [], expires: Date.now() + CACHE_TTL_MS });
            return [];
        }

        const typeRows = await prisma.platformAmbassadorType.findMany({
            where: { key: { in: enabledKeys }, isActive: true },
        });

        const value: AmbassadorTypeDefinition[] = typeRows.map((row) => ({
            key: row.key,
            label: row.label,
            proofFieldLabel: row.proofFieldLabel,
            applicationFields: row.applicationFields as unknown as ApplicationFieldDef[],
        }));

        enabledTypesCache.set(organizationId, { value, expires: Date.now() + CACHE_TTL_MS });
        return value;
    } catch (err) {
        console.error(`getEnabledAmbassadorTypes('${organizationId}') DB read failed:`, err);
        // Fail closed: an org whose catalog can't be read simply has no
        // ambassador types available, never crashes a request.
        return cached?.value ?? [];
    }
}

/**
 * Returns null if the type doesn't exist, is inactive, or isn't enabled for
 * this org — one call site for "is this type actually usable by this org
 * right now", used by both apply-time validation and applications-queue
 * rendering.
 */
export async function getAmbassadorTypeByKey(
    key: string,
    organizationId: string,
): Promise<AmbassadorTypeDefinition | null> {
    const types = await getEnabledAmbassadorTypes(organizationId);
    return types.find((t) => t.key === key) ?? null;
}
