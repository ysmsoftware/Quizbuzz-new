"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { posthog, initPostHog } from "@/lib/posthog";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isInitialized = useRef(false);

    // Initialize PostHog once and capture the first pageview immediately after.
    // Doing this in a single effect avoids the race where the pathname effect
    // fires on mount before posthog.init() has run, silently dropping the first
    // pageview.
    useEffect(() => {
        initPostHog();
        isInitialized.current = true;

        // Capture the initial pageview now that PostHog is ready
        posthog.capture("$pageview", { $current_url: window.location.href });
    }, []);

    // Track subsequent client-side navigations as pageviews.
    // We skip the very first render (handled above) to avoid double-counting.
    useEffect(() => {
        if (!isInitialized.current) return;

        let url = window.origin + pathname;
        if (searchParams?.toString()) {
            url = `${url}?${searchParams.toString()}`;
        }
        posthog.capture("$pageview", { $current_url: url });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, searchParams]);

    return <>{children}</>;
}