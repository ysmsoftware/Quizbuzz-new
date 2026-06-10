import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const isProd = process.env.NODE_ENV === "production";


const tracesSampleRate = isProd ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1) : 1.0;
const profilesSampleRate = isProd ? Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.1) : 1.0;

Sentry.init({
    dsn: process.env.SENTRY_DSN,

    enabled: process.env.NODE_ENV !== "development",

    environment: process.env.NODE_ENV,
    release: process.env.APP_VERSION ?? "local",

    tracesSampleRate,
    profilesSampleRate,

    integrations: [
        nodeProfilingIntegration(),
        Sentry.expressIntegration(),
        Sentry.prismaIntegration(),
    ],
});