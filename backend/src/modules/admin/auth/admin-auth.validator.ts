import { z } from 'zod';



// shared

const emailField = z.string().email("Invalid email address").toLowerCase().trim();

const passwordField = z.string()
    .min(8,"Password must be at least 8 characters")
    .max(72, "Password too long")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number")


const ulidField = z.ulid("Invalid ID format");


// Schema

export const RegisterAdminSchema = z.object({
    email: emailField,
    password: passwordField,
    firstName: z.string().min(1).max(50).trim(),
    lastName: z.string().min(1).max(50).trim(),
});

export const LoginAdminSchema = z.object({
    email: emailField,
    password: z.string().min(1, "Password is required"),
});

export const SwitchOrgSchema = z.object({
    organizationId: ulidField,
});

export const VerifyEmailSchema = z.object({
    email: emailField,
    otp: z.string().length(6, "OTP must be exactly 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
});

export const ResendVerificationSchema = z.object({
    email: emailField,
});

export const ForgotPasswordSchema = z.object({
    email: emailField,
});

export const ResetPasswordSchema = z.object({
    token: z.string().min(1, "Token is required"),
    newPassword: passwordField,
});



// ─── Type exports (inferred from schema) ─────────────────────────────────────
 
export type RegisterAdminInput = z.infer<typeof RegisterAdminSchema>;
export type LoginAdminInput = z.infer<typeof LoginAdminSchema>;
export type SwitchOrgInput = z.infer<typeof SwitchOrgSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

