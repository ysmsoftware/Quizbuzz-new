import rateLimit from "express-rate-limit";
import { config } from "../config/index.js";

/**
 * ─── RATE LIMITERS ────────────────────────────────────────────────────────────
 * 
 * Centralized rate limiting configuration for different use cases.
 * These can be applied to specific routes or globally in app.ts.
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * Global API Limiter: General protection for all API endpoints.
 */
export const globalLimiter = rateLimit({
    windowMs: (config.rateLimit.window || 15 * 60) * 1000, // Default 15 minutes (env is in seconds)
    limit: config.rateLimit.max || 100, // Limit each IP to X requests per window
    message: {
        status: 429,
        message: "Too many requests, please try again later.",
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Auth Limiter: Stricter limits for login and registration to prevent brute force.
 */
export const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 15 minutes
    limit: config.rateLimit.login || 15,
    message: {
        status: 429,
        message: "Too many authentication attempts, please try again after 15 minutes.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * OTP Limiter: Very strict limits for OTP generation and verification.
 */
export const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    limit: process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true' ? 100000 : (config.rateLimit.otp || 5),
    message: {
        status: 429,
        message: "Too many OTP requests, please try again after 10 minutes.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Analytics Limiter: Prevents excessive data-heavy analytics requests.
 */
export const analyticsLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    limit: 20, // Allow 20 requests every 5 minutes
    message: {
        status: 429,
        message: "Analytics threshold reached, please slow down.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Public/Discovery Limiter: For routes that don't require auth but are public (e.g., contest info).
 */
export const publicLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 60, // 60 requests per minute
    message: {
        status: 429,
        message: "Too many requests to public resources.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
