import { z } from "zod";
import { ViolationType } from "@prisma/client";

export const ProctoringPaginationSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    type: z.nativeEnum(ViolationType).optional(),
    isFlagged: z.preprocess((val) => val === "true", z.boolean()).optional(),
});

export const UpdateViolationStatusSchema = z.object({
    isDismissed: z.boolean(),
    adminNotes: z.string().max(500).optional(),
});

export type ProctoringPaginationInput = z.infer<typeof ProctoringPaginationSchema>;
export type UpdateViolationStatusInput = z.infer<typeof UpdateViolationStatusSchema>;
