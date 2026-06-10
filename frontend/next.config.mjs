import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },

    images: {
        unoptimized: true,
    },
}

export default withSentryConfig(nextConfig, {
    org: "ysm-infosolution",
    project: "quizbuzz-frontend",
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: true,
    widenClientFileUpload: true,
    hideSourceMaps: true,
    telemetry: false,
});