import { config } from "../config";
import crypto from 'crypto';

type OtpPurpose = "LOGIN" | "REGISTRATION" | "PASSWORD_RESET" | "QUIZ_AUTH";

export function generateotp(): string {
    const length = config.auth.otp.length;
    const max = Math.pow(10, length);
    return crypto.randomInt(0, max).toString().padStart(length, "0");
}

export function hashOtp(otp: string): string {
    return crypto
        .createHmac("sha256", config.auth.otp.secret)
        .update(otp)
        .digest("hex");
}


export function compareOtp(plain: string, stored: string): boolean {
    const hash = hashOtp(plain);

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(stored));
}

export function otpKey(contactId: string, purpose: OtpPurpose): string {
    return `auth:otp:${contactId}:${purpose}`;
}