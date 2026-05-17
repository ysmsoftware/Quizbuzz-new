import { z } from "zod";
import { ParticipantStatus } from "@prisma/client";

export const ListParticipantsQuerySchema = z.object({
    status: z.nativeEnum(ParticipantStatus).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    search: z.string().optional(),
});

export const DisqualifyParticipantSchema = z.object({
    reason: z.string().min(5).max(500),
});

export const RegisterParticipantSchema = z.object({
    contactId: z.string().min(1),
    contestId: z.string().min(1),
    registrationRef: z.string().min(1),
});
