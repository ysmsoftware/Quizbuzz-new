/**
 * Quiz Module — Zod Validators
 *
 * Every WebSocket event payload is validated at the gateway layer
 * before reaching any service. This prevents malformed data from
 * polluting Redis or PostgreSQL.
 */

import { z } from "zod";

// ─── Auth Events ──────────────────────────────────────────────────────────────

export const AuthenticateSchema = z.object({
    contestSlug: z.string().min(1).max(200),
    contactToken: z.string().min(1),
});

export const VerifyOtpSchema = z.object({
    otp: z.string().length(6).regex(/^\d{6}$/, "OTP must be 6 digits"),
    contestId: z.string().min(1).optional(),
});

export const VerifyJoinCodeSchema = z.object({
    joinCode: z.string().min(4).max(20),
});

// ─── Waiting Room Events ──────────────────────────────────────────────────────

export const ReadyCheckSchema = z.object({
    cameraGranted: z.boolean(),
});

// ─── Quiz Events ──────────────────────────────────────────────────────────────

export const AnswerSchema = z.object({
    questionId: z.string().min(1),
    selectedOptionId: z.string().min(1).nullable(),
    answeredAt: z.string().datetime({ message: "answeredAt must be ISO 8601" }),
});

// ─── Proctoring Events ───────────────────────────────────────────────────────

const ViolationTypeEnum = z.enum([
    "FACE_NOT_DETECTED",
    "MULTIPLE_FACES",
    "AUDIO_ANOMALY",
    "POOR_LIGHTING",
    "GAZE_AWAY",
    "TAB_SWITCH",
    "WINDOW_BLUR",
    "FULLSCREEN_EXIT",
    "SCREEN_RESIZE",
]);

const ViolationSeverityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const ViolationSchema = z.object({
    type: ViolationTypeEnum,
    severity: ViolationSeverityEnum,
    metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─── Snapshot Events ──────────────────────────────────────────────────────────

const CaptureTypeEnum = z.enum(["START", "MID_POINT", "RANDOM", "PRE_SUBMIT"]);

export const SnapshotSchema = z.object({
    imageBase64: z.string().min(100).max(2_000_000), // ~1.5 MB max base64
    captureType: CaptureTypeEnum,
    timestamp: z.string().datetime(),
});

// ─── Admin Events ─────────────────────────────────────────────────────────────

export const AdminSubscribeSchema = z.object({
    contestId: z.string().min(1),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type AuthenticateInput = z.infer<typeof AuthenticateSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type VerifyJoinCodeInput = z.infer<typeof VerifyJoinCodeSchema>;
export type ReadyCheckInput = z.infer<typeof ReadyCheckSchema>;
export type AnswerInput = z.infer<typeof AnswerSchema>;
export type ViolationInput = z.infer<typeof ViolationSchema>;
export type SnapshotInput = z.infer<typeof SnapshotSchema>;
export type AdminSubscribeInput = z.infer<typeof AdminSubscribeSchema>;
