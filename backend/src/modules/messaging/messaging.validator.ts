import { z } from "zod";
import { MessageChannel, MessageTemplate } from "@prisma/client";

export const SendMessageSchema = z.object({
    participantId: z.string().optional(),
    contactId: z.string().optional(),
    contestId: z.string().optional(),
    channel: z.nativeEnum(MessageChannel),
    template: z.nativeEnum(MessageTemplate),
    recipient: z.string(),
    subject: z.string().optional(),
    body: z.string().optional(),
    parameters: z.record(z.string(), z.string()).optional(),
});

export const PaginationQuerySchema = z.object({
    page: z.string().optional().default("1").transform((val) => parseInt(val, 10)),
    limit: z.string().optional().default("20").transform((val) => parseInt(val, 10)),
});
