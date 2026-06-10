// src/services/analytics.service.ts
import { PostHog } from "posthog-node";
import logger from "../config/logger";
import { config } from "../config";

// Singleton — one client for the entire process lifetime
const client = new PostHog(config.posthog.apiKey, {
    host: config.posthog.host,
    // Flush events every 30s or when buffer hits 20 events
    flushAt: config.posthog.flushAt,
    flushInterval: config.posthog.flushInterval,
    // Disable in development so you don't pollute analytics with test data
    disabled: config.app.nodeEnv === "development",
});

type EventProperties = Record<string, string | number | boolean | null | undefined>;

/**
 * Capture a server-side event for a known user (participant or admin).
 * Fire-and-forget — never awaited, never throws.
 */
function capture(
    distinctId: string,
    event: string,
    properties?: EventProperties
): void {
    try {
        client.capture({
            distinctId,
            event,
            properties: {
                source: "backend",
                instanceId: config.app.instanceId,
                ...properties,
            },
        });
    } catch (err) {
        // Never let analytics break the happy path
        logger.warn(`PostHog capture failed for event "${event}"`, err);
    }
}

/**
 * Track a contest registration completing (payment confirmed or free registration).
 */
function trackRegistration(params: {
    contactId: string;
    contestId: string;
    contestSlug: string;
    organizationId: string;
    paymentRequired: boolean;
    amount?: number;
}): void {
    capture(params.contactId, "contest_registration_completed", {
        contestId: params.contestId,
        contestSlug: params.contestSlug,
        organizationId: params.organizationId,
        paymentRequired: params.paymentRequired,
        amount: params.amount,
    });
}

/**
 * Track when a participant submits the quiz (normal submit or auto-submit).
 */
function trackQuizSubmit(params: {
    participantId: string;
    contestId: string;
    organizationId: string;
    timeTakenSecs: number;
    autoSubmit: boolean;
}): void {
    capture(params.participantId, "quiz_submitted", {
        contestId: params.contestId,
        organizationId: params.organizationId,
        timeTakenSecs: params.timeTakenSecs,
        autoSubmit: params.autoSubmit,
    });
}

/**
 * Track payment events (created, verified, failed).
 */
function trackPayment(params: {
    contactId: string;
    contestId: string;
    organizationId: string;
    status: "created" | "verified" | "failed";
    amount: number;
    provider: string;
}): void {
    capture(params.contactId, `payment_${params.status}`, {
        contestId: params.contestId,
        organizationId: params.organizationId,
        amount: params.amount,
        provider: params.provider,
    });
}

/**
 * Track OTP request (to measure email funnel drop-off).
 */
function trackOtpRequested(email: string, contestSlug: string): void {
    // Use email as distinctId before we have a contactId
    capture(email, "otp_requested", { contestSlug });
}

/**
 * Track certificate issued.
 */
function trackCertificateIssued(params: {
    participantId: string;
    contestId: string;
    organizationId: string;
}): void {
    capture(params.participantId, "certificate_issued", {
        contestId: params.contestId,
        organizationId: params.organizationId,
    });
}

/**
 * Flush remaining events on graceful shutdown.
 * Call this in your shutdown() function.
 */
async function shutdown(): Promise<void> {
    await client.shutdown();
}

export const analyticsTracker = {
    trackRegistration,
    trackQuizSubmit,
    trackPayment,
    trackOtpRequested,
    trackCertificateIssued,
    shutdown,
};