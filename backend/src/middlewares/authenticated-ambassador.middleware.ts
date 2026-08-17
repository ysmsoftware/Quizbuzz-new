import { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import jwt from "jsonwebtoken";
import { config } from "../config";
import logger from "../config/logger";
import { UnauthorizedError } from "../error/http-errors";
import { AmbassadorRepository } from "../modules/ambassador/ambassador.repository";

const ambassadorRepo = new AmbassadorRepository();

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

        let payload: { ambassadorId: string };
        try {
            payload = jwt.verify(token, config.auth.jwt.accessSecret) as { ambassadorId: string };
        } catch (err) {
            throw new UnauthorizedError("Invalid ambassador session token");
        }

        const ambassador = await ambassadorRepo.findById(payload.ambassadorId);
        if (!ambassador || !ambassador.isActive) {
            throw new UnauthorizedError("This ambassador account has been deactivated.");
        }

        req.ambassador = {
            id: payload.ambassadorId,
        };

        Sentry.getCurrentScope().setUser({
            id: payload.ambassadorId,
        } as any);

        logger.debug(`Ambassador authenticated: ${payload.ambassadorId}`);
        next();
    } catch (error) {
        next(error);
    }
};
