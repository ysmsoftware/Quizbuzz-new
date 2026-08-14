import { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import jwt from "jsonwebtoken";
import { config } from "../config";
import logger from "../config/logger";
import { UnauthorizedError } from "../error/http-errors";

export const authenticatedAmbassadorMiddleware = async (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    try {
        let token: string | undefined = req.cookies?.ambassadorToken;

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader?.startsWith("Bearer ")) {
                token = authHeader.split(" ")[1];
            }
        }

        if (!token) {
            token = req.headers["x-ambassador-token"] as string;
        }

        if (!token) {
            throw new UnauthorizedError("Unauthorized ambassador");
        }

        try {
            const payload = jwt.verify(token, config.auth.jwt.accessSecret) as {
                ambassadorId: string;
                organizationId: string;
            };

            req.ambassador = {
                id: payload.ambassadorId,
                organizationId: payload.organizationId,
            };

            Sentry.getCurrentScope().setUser({
                id: payload.ambassadorId,
                organizationId: payload.organizationId,
            } as any);

            logger.debug(`Ambassador authenticated: ${payload.ambassadorId} org: ${payload.organizationId}`);
            next();
        } catch (err) {
            throw new UnauthorizedError("Invalid ambassador session token");
        }
    } catch (error) {
        next(error);
    }
};
