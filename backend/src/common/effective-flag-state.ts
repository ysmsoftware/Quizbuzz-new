/**
 * Single responsibility: turn a feature flag's global default plus an
 * optional active per-organization override into the effective boolean
 * actually in force. This is the one shared place isFeatureEnabled() (and
 * any future API response) calls into — mirrors why effective-limits.ts
 * exists in the ops-next repo: resolution logic duplicated across call
 * sites tends to drift and disagree.
 *
 * Boolean-only, so there's nothing to fold or stack like the numeric
 * ADDITIVE/ABSOLUTE overrides in ops-next's own effective-limits.ts — an
 * active org override just wins outright when present.
 */

export interface OrgOverrideInput {
    isEnabled: boolean;
    expiresAt: Date | null;
}

export interface EffectiveFlagState {
    value: boolean;
    overridden: boolean;
}

export function isOrgOverrideActive(override: OrgOverrideInput, now: Date = new Date()): boolean {
    return override.expiresAt === null || override.expiresAt > now;
}

export function computeEffectiveFlagState(
    globalValue: boolean,
    orgOverride: OrgOverrideInput | null,
): EffectiveFlagState {
    if (orgOverride && isOrgOverrideActive(orgOverride)) {
        return { value: orgOverride.isEnabled, overridden: true };
    }
    return { value: globalValue, overridden: false };
}
