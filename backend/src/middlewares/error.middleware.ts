import { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import { AppError } from "../error/app-error";
import { PlanLimitExceededError } from "../error/http-errors";
import logger from "../config/logger";
import { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";
import { ZodError } from "zod";

const statusToCode = (status: number): string => {
    const map: Record<number, string> = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        410: "GONE",
        422: "UNPROCESSABLE",
    };
    return map[status] || "ERROR";
};

export const globalErrorHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    const requestId = (req as any).id;
    const { method, originalUrl } = req;

    // Always clear the Sentry user scope after a request errors out.
    // Express reuses worker threads across requests; without this, a failed
    // request could leak its user context into a subsequent unrelated request.
    Sentry.getCurrentScope().setUser(null);

    // ── 1. Zod Validation Error Handler ──────────────────────────────────
    if (err instanceof ZodError) {
        const details: Record<string, string[]> = {};
        err.issues.forEach((issue) => {
            const path = issue.path.join('.') || 'root';
            if (!details[path]) details[path] = [];
            details[path].push(issue.message);
        });

        return res.status(400).json({
            success: false,
            code: "VALIDATION_ERROR",
            message: err.issues[0]?.message || "Validation failed",
            details,
            requestId,
        });
    }

    // ── 2. JWT errors — return 401 so the frontend can trigger token refresh ──
    if (err instanceof TokenExpiredError) {
        return res.status(401).json({
            success: false,
            code: "UNAUTHORIZED",
            message: "Token expired",
            requestId,
        });
    }

    if (err instanceof JsonWebTokenError) {
        return res.status(401).json({
            success: false,
            code: "UNAUTHORIZED",
            message: "Invalid token",
            requestId,
        });
    }

    // ── 3. Plan/subscription limit errors ──────────────────────────────────────
    // Surfaced with a distinct machine-readable code + structured limit info so the
    // frontend can render an "Upgrade your plan" prompt instead of a generic error.
    if (err instanceof PlanLimitExceededError) {
        logger.warn(`${err.message} - [${method} ${originalUrl}] (ReqID: ${requestId})`);
        return res.status(err.statusCode).json({
            success: false,
            code: "PLAN_LIMIT_EXCEEDED",
            message: err.message,
            limitType: err.limitType,
            limit: err.limit,
            current: err.current,
            requestId,
        });
    }

    // ── 4. AppError ──────────────────────────────────────────────────────────
    if (err instanceof AppError) {
        logger.warn(`${err.message} - [${method} ${originalUrl}] (ReqID: ${requestId})`);
        return res.status(err.statusCode).json({
            success: false,
            code: statusToCode(err.statusCode),
            message: err.message,
            requestId,
        });
    }

    // ── 5. Fallback handler ──────────────────────────────────────────────────
    // Handle non-Error thrown objects (e.g. Razorpay SDK rejects with plain objects)
    const message = err?.message ?? (typeof err === "object" ? JSON.stringify(err) : String(err))
    logger.error(`${message} - [${method} ${originalUrl}] (ReqID: ${requestId})`, { stack: err?.stack, raw: err });

    return res.status(500).json({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        requestId,
    });
};
