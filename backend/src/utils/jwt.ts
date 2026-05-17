import jwt from "jsonwebtoken";
import { config } from "../config/index";
export interface JwtPayload {
    userId: string,
    organizationId: string,
}

export const createAccessToken = (payload: JwtPayload) => {
    return jwt.sign(payload, config.auth.jwt.accessSecret, {
        expiresIn: "30m",
    });
};

export const createRefreshToken = (payload: JwtPayload) => {
    return jwt.sign(payload, config.auth.jwt.refreshSecret, {
        expiresIn: '7d',
    });
};

export const verifyToken = (token: string) => {
    return jwt.verify(token, config.auth.jwt.accessSecret) as JwtPayload;
};

export const verifyRefreshToken = (token: string) => {
    return jwt.verify(token, config.auth.jwt.refreshSecret) as JwtPayload;
};