import { z } from "zod";

// ─── List / filter ────────────────────────────────────────────────────────────

export const listSubmissionsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z
        .enum(["PENDING", "SUBMITTED", "EVALUATED", "INVALIDATED"])
        .optional(),
    search: z.string().trim().optional(),
});

// ─── Invalidate ───────────────────────────────────────────────────────────────

export const invalidateSubmissionSchema = z.object({
    reason: z.string().trim().min(1, "Reason is required"),
});

// ─── Trigger evaluation (admin → contest scope) ───────────────────────────────

export const triggerEvaluationSchema = z.object({
    // contestId comes from route param — no body required
    // kept as an empty object so zod.parse() is uniform in the controller
});

// ─── Manual Submit (Participant) ──────────────────────────────────────────────
export const submitSubmissionSchema = z.object({
    participantId: z.string().min(1, "Invalid participant ID"),
    timeTakenSecs: z.number().int().min(0),
    timeTakenMs: z.number().int().min(0).optional(),
    answers: z.array(
        z.object({
            questionId: z.string().min(1),
            selectedOptionId: z.string().nullable(),
        })
    ),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type ListSubmissionsQuery = z.infer<typeof listSubmissionsSchema>;
export type InvalidateSubmissionInput = z.infer<typeof invalidateSubmissionSchema>;
export type SubmitSubmissionInput = z.infer<typeof submitSubmissionSchema>;
