import { z } from "zod";
import { ContestStatus } from "@prisma/client";

// PRIZE

export const PrizeSchema = z.object({
    rankFrom: z.number().int().positive(),
    rankTo: z.number().int().positive(),
    amount: z.number().min(0),
    currency: z.string().default("INR"),
    label: z.string().max(100).optional(),
    benefits: z.array(z.string()).max(10).optional(),
}).refine((p) => p.rankTo >= p.rankFrom, {
    message: "rankTo must be >= rankFrom",
});

// CREATE CONTEST

// CREATE CONTEST

const CreateContestBase = z.object({
    title: z.string().min(3).max(200),
    description: z.string().optional(),
    details: z.string().optional(),
    topics: z.array(z.string()).default([]),
    rules: z.array(z.string()).default([]),
    paymentEnabled: z.boolean().default(false),
    paymentConfig: z.object({
        amount: z.number().int().min(0),
        currency: z.string().default("INR"),
        description: z.string().optional()
    }).optional(),
    duration: z.number().int().min(10).max(480), // 10 min – 8 hrs
    cutoffScore: z.number().int().min(0).max(100).optional(),
    maxParticipants: z.number().int().positive().optional(),
    registrationDeadline: z.coerce.date(),
    startTime: z.coerce.date(),
    joinCode: z.string().min(4).max(20).optional(),
    shuffleQuestions: z.boolean().default(true),
    shuffleOptions: z.boolean().default(false),
    proctoringEnabled: z.boolean().default(true),
    showResultsAfter: z.number().int().min(0).max(168).default(24), // max 7 days
    prizes: z.array(PrizeSchema).optional(),
});

export const CreateContestSchema = CreateContestBase.refine(
    (d) => d.startTime > d.registrationDeadline,
    { message: "startTime must be after registrationDeadline", path: ["startTime"] }
).refine(
    (d) => d.startTime > new Date(),
    { message: "startTime must be in the future", path: ["startTime"] }
);


// UPDATE CONTEST

export const UpdateContestSchema = CreateContestBase.partial();
// REGISTER FOR CONTEST

export const RegisterParticipantSchema = z.object({
    contactToken: z.string().min(1),
    email: z.string().email().toLowerCase(),
    phone: z
        .string()
        .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number (E.164 expected)")
        .optional(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().max(100).optional(),
    college: z.string().optional(),
    department: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
});


// QUERY SCHEMAS

export const ListContestsQuerySchema = z.object({
    status: z.nativeEnum(ContestStatus).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
});



export const ListParticipantsQuerySchema = z.object({
    status: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(10000).default(1000),
});

// ADMIN ACTIONS


export const GenerateCertificatesSchema = z.object({
    participantIds: z.array(z.string()).optional(),
    notifyParticipants: z.boolean().default(true),
});

export const AssignQuestionsSchema = z.object({
    questions: z.array(z.object({
        questionId: z.string().min(1),
        position: z.number().int().positive(),
        marks: z.number().min(0),
        negativeMark: z.number().min(0).default(0),
    })),
});

export const ReorderQuestionsSchema = z.object({
    order: z.array(z.string().min(1)),
});

export const DisqualifyParticipantSchema = z.object({
    reason: z.string().min(5).max(500),
});

export const CancelContestSchema = z.object({
    reason: z.string().max(500).optional(),
});

export const SendContestMessageSchema = z.object({
    contestId: z.string().min(1),
    template: z.string().min(1),
    channel: z.enum(["WHATSAPP", "EMAIL"]),
});

export type CreateContestInput = z.infer<typeof CreateContestSchema>;
export type UpdateContestInput = z.infer<typeof UpdateContestSchema>;
export type ListContestsQueryInput = z.infer<typeof ListContestsQuerySchema>;
export type RegisterParticipantInput = z.infer<typeof RegisterParticipantSchema>;
export type AssignQuestionsInput = z.infer<typeof AssignQuestionsSchema>;
export type ReorderQuestionsInput = z.infer<typeof ReorderQuestionsSchema>;
export type GenerateCertificatesInput = z.infer<typeof GenerateCertificatesSchema>;
export type DisqualifyParticipantInput = z.infer<typeof DisqualifyParticipantSchema>;
export type CancelContestInput = z.infer<typeof CancelContestSchema>;