import { prisma } from "../config/db";
import { config } from "../config";
import { computeEffectiveFlagState, computeOptInFlagState } from "./effective-flag-state";

// Flags where the global toggle is a pure availability gate / kill switch,
// not a default. Every other flag here is the opposite: global=true means
// on for everyone, and an org override exists only to turn ONE org off.
// These are the reverse — global=true just makes the feature grantable;
// an org still needs its own active override to actually have it, and
// global=false always wins over any override. See computeOptInFlagState.
const OPT_IN_ONLY_FLAGS = new Set(["ambassador_program_enabled"]);

/**
 * Org-aware feature-flag SDK, backed by quizbuzz-ops-next's write-through
 * (see that repo's FeatureFlagsService — every global toggle / org-override
 * change UPSERTs into platform_feature_flags / organization_feature_flag_overrides
 * on this app's own database via queryMainDb). This module only ever reads —
 * ops-next is the single source of truth for what's written here.
 *
 * The "zero new plumbing to add a flag" contract: a new flag is a new row in
 * ops-next's FeatureFlag table plus a new call site here doing
 * `if (await isFeatureEnabled('new_flag_key', { organizationId }))`. No new
 * route, no new cache wiring.
 */

const flagCache = new Map<string, { value: boolean; expires: number }>();

// Differentiated TTL: maintenance_mode needs to propagate fast (a stuck
// "still live" window is worse than a few extra cache misses); routine
// flags can tolerate a minute of staleness.
const TTL_MS: Record<string, number> = {
    maintenance_mode: 5_000,
    new_registrations_paused: 5_000,
};
const DEFAULT_TTL_MS = 60_000;

export async function isFeatureEnabled(
    key: string,
    context?: { organizationId?: string },
): Promise<boolean> {
    const orgId = context?.organizationId;
    const cacheKey = `${key}:${orgId ?? "global"}`;
    const cached = flagCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.value;

    try {
        const [globalRow, overrideRow] = await Promise.all([
            prisma.platformFeatureFlag.findUnique({ where: { key } }),
            orgId
                ? prisma.organizationFeatureFlagOverride.findUnique({
                      where: { key_organizationId: { key, organizationId: orgId } },
                  })
                : Promise.resolve(null),
        ]);

        // Fail-closed on "flag not found": an unrecognized key is treated as
        // off, never as "assume the old/default behavior".
        const globalValue = globalRow?.isEnabled ?? false;
        const { value } = OPT_IN_ONLY_FLAGS.has(key)
            ? computeOptInFlagState(globalValue, overrideRow)
            : computeEffectiveFlagState(globalValue, overrideRow);

        flagCache.set(cacheKey, { value, expires: Date.now() + (TTL_MS[key] ?? DEFAULT_TTL_MS) });
        return value;
    } catch (err) {
        console.error(`isFeatureEnabled('${key}', ${JSON.stringify(context)}) DB read failed:`, err);
        // Serve stale cache if we have it, else fail closed (favor
        // availability — an unrelated DB hiccup should never accidentally
        // maintenance-lock the whole platform or strip a paid org add-on).
        return cached?.value ?? false;
    }
}

/**
 * proctoring_enabled_platform_wide reconciled with the pre-existing
 * ENABLE_PROCTORING env var (config.features.proctoring): the env var stays
 * a deploy-time hard ceiling ops can only narrow, never override on — the DB
 * flag (global default or an active org override) can only turn proctoring
 * further OFF within whatever the env var already allows. Centralized here
 * (rather than repeated at each of the 3 real call sites — proctoring.service.ts,
 * capture-metadata.worker.ts, quiz.gateway.ts) so the ceiling logic can't drift.
 */
export async function isProctoringEnabled(organizationId?: string): Promise<boolean> {
    if (!config.features.proctoring) return false;
    return isFeatureEnabled(
        "proctoring_enabled_platform_wide",
        organizationId ? { organizationId } : undefined,
    );
}
