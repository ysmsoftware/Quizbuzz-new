import { config } from "../config";

/**
 * Single formatting entry-point for any date shown to a human (emails, certificates,
 * exports). Every call site MUST go through here rather than `Date#toLocaleString`
 * directly — `toLocaleString`'s `timeZone` option is what actually controls the
 * displayed time; the locale argument (e.g. "en-IN") only controls number/word
 * formatting and is commonly mistaken for also fixing the timezone. Left unset,
 * formatting silently falls back to the server process's local time, which is
 * whatever the OS defaults to — UTC on a fresh AWS instance, something else on a
 * developer's machine — and can differ instance-to-instance under auto-scaling.
 * This is exactly the class of bug this module exists to close off.
 *
 * `timezone` should be the organization's own IANA zone (OrganizationProfile.timezone,
 * captured from the browser at onboarding via Intl.DateTimeFormat().resolvedOptions().
 * timeZone) — resolveTimezone() below is what supplies the platform-wide fallback
 * when an org hasn't set one.
 */
export function formatDateInTimezone(
    date: Date | string,
    timezone: string | null | undefined,
    options: Intl.DateTimeFormatOptions,
    locale = "en-IN",
): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString(locale, { ...options, timeZone: resolveTimezone(timezone) });
}

/** The effective IANA timezone to format a date in — the org's own if set, otherwise
 *  the config-driven platform default (DEFAULT_TIMEZONE). Centralizing the fallback
 *  here means "what do we show an org that hasn't configured one yet" is decided in
 *  exactly one place, not re-guessed at every call site. */
export function resolveTimezone(timezone: string | null | undefined): string {
    return timezone && timezone.trim() ? timezone : config.app.defaultTimezone;
}

/** "14 September 2025" */
export function formatDateHuman(date: Date | string, timezone: string | null | undefined): string {
    return formatDateInTimezone(date, timezone, { dateStyle: "long" });
}

/** "3:30 PM" */
export function formatTimeHuman(date: Date | string, timezone: string | null | undefined): string {
    return formatDateInTimezone(date, timezone, { timeStyle: "short" });
}

/** "14 September 2025, 3:30 PM" */
export function formatDateTimeHuman(date: Date | string, timezone: string | null | undefined): string {
    return formatDateInTimezone(date, timezone, { dateStyle: "long", timeStyle: "short" });
}
