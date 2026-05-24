import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import logger from "../config/logger";
import { UnauthorizedError } from "../error/http-errors";

export const authenticatedParticipantMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined = req.cookies?.participantToken;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      token = req.headers["x-participant-token"] as string;
    }

    if (!token) {
      throw new UnauthorizedError("Unauthorized participant");
    }

    try {
      const payload = jwt.verify(token, config.auth.jwt.accessSecret) as {
        participantId: string;
        contestId: string;
        organizationId: string;
      };

      req.participant = {
        id: payload.participantId,
        contestId: payload.contestId,
        organizationId: payload.organizationId,
      };

      logger.debug(`Participant authenticated: ${payload.participantId} contest: ${payload.contestId}`);
      next();
    } catch (err) {
      throw new UnauthorizedError("Invalid participant session token");
    }
  } catch (error) {
    next(error);
  }
};
