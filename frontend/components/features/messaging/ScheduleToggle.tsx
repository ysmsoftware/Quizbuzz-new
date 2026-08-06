/**
 * REMOVED — scheduled messaging is not implemented.
 *
 * This component rendered a "Send Now / Schedule" choice where the Schedule half was
 * permanently disabled behind a "coming soon" tooltip. Presenting a two-option control
 * with only one working option is misleading, and it had no remaining call sites.
 *
 * Messages are sent immediately; there is no send-time choice to make. If scheduling
 * is built later, reintroduce this alongside a real scheduled-send backend path
 * (a delayed messageQueue job keyed by contest, mirroring the reminder jobs in
 * QuizSchedulerService) rather than restoring the disabled-button UI.
 *
 * Intentionally left as an empty module so any stale import fails loudly at build
 * time instead of silently rendering dead UI.
 */

export {};
