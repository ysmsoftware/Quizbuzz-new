// lib/posthog.ts
import posthog from "posthog-js";

export function initPostHog(): void {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "development") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",


        capture_pageview: false,


        respect_dnt: true,


        autocapture: {

            dom_event_allowlist: ["click"],
            element_allowlist: ["button", "a"],
            css_selector_allowlist: ["[data-track]"],
        },

        loaded: (ph) => {
            if (process.env.NODE_ENV !== "production") {
                ph.debug();
            }
        },
    });
}

export { posthog };