import jwt from "jsonwebtoken";
import { config } from "../config/index";

export interface ContactTokenPayload {
    email: string;
    phone?: string;
    organizationId: string;
}

export const verifyContactToken = async (token: string): Promise<ContactTokenPayload> => {
    return jwt.verify(token, config.auth.jwt.contactSecret) as ContactTokenPayload;
};

export const createContactToken = (payload: ContactTokenPayload) => {
    return jwt.sign(payload, config.auth.jwt.contactSecret, {
        expiresIn: config.auth.jwt.contactTtl,
    });
};
