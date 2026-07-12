import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    disable: process.env.NEXT_PUBLIC_ENABLE_PWA !== "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },

    images: {
        unoptimized: true,
    },
}

export default withSentryConfig(
    withSerwist(nextConfig),
    {
        org: "ysm-infosolution",
        project: "quizbuzz-frontend",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        silent: true,
        widenClientFileUpload: true,
        hideSourceMaps: true,
        telemetry: false,
    }
);
