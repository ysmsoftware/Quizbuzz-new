import { z } from "zod";
import { ContestStatus } from "@prisma/client";
import { config } from "../../config";

/**
 * Enforcement layer for the 15-minute start-time grid (contest-start-reliability
 * spec §6.4) — reduces user mis-entry of odd start times. The frontend picker is a UX
 * nicety on top of this, not the source of truth; config.contest.startTimeSlotMinutes
 * stays the single place this threshold is defined.
 */
function isOnStartTimeGrid(date: Date): boolean {
    return date.getMinutes() % config.contest.startTimeSlotMinutes === 0 && date.getSeconds() === 0;
}

const START_TIME_GRID_MESSAGE = () => {
    const step = config.contest.startTimeSlotMinutes;
    const marks: string[] = [];
    for (let m = 0; m < 60; m += step) marks.push(`:${String(m).padStart(2, "0")}`);
    return `Start time must land on a ${step}-minute mark (${marks.join(", ")})`;
};

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
    bannerImage: z.string().optional().nullable(),
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
    defaultQuestionMarks: z.number().int().min(1).default(4),
    defaultQuestionNegativeMark: z.number().min(0).max(10).default(1),
    prizes: z.array(PrizeSchema).optional(),
    certificateTemplateId: z.string().optional().nullable(),
});

export const CreateContestSchema = CreateContestBase.refine(
    (d) => d.startTime > d.registrationDeadline,
    { message: "startTime must be after registrationDeadline", path: ["startTime"] }
).refine(
    (d) => d.startTime > new Date(),
    { message: "startTime must be in the future", path: ["startTime"] }
).refine(
    (d) => isOnStartTimeGrid(d.startTime),
    { message: START_TIME_GRID_MESSAGE(), path: ["startTime"] }
);


// UPDATE CONTEST

/**
 * `.strict()` is load-bearing, not decoration.
 *
 * Zod objects strip unknown keys by default, which turned two separate client/server
 * field-name mismatches into silent no-ops that reported HTTP 200 and toasted success:
 *   1. the inline "Contest Ends" editor posts `durationMinutes` → dropped, so
 *      duration/endTime never changed and AUTO_SUBMIT stayed on the old schedule;
 *   2. the cancel modal posts `status` + `cancelReason` → both dropped, so contests
 *      were never actually cancelled.
 * Rejecting unknown keys makes that whole class of bug a loud 400 instead.
 *
 * `durationMinutes` is accepted as an explicit alias (the admin UI's own field name)
 * and normalised onto `duration` so there is one canonical field downstream.
 */
export const UpdateContestSchema = CreateContestBase.partial()
    .extend({
        durationMinutes: z.number().int().min(10).max(480).optional(),
        applyToExistingQuestions: z.boolean().optional(),
    })
    .strict()
    .transform(({ durationMinutes, ...rest }) => {
        const normalised = { ...rest } as Omit<typeof rest, never> & { duration?: number };
        if (normalised.duration === undefined && durationMinutes !== undefined) {
            normalised.duration = durationMinutes;
        }
        return normalised;
    });

/** Timing fields. Once a contest is published these may only change via reschedule. */
export const TIMING_FIELDS = ["startTime", "registrationDeadline", "duration", "durationMinutes"] as const;

// RESCHEDULE CONTEST

/**
 * A reschedule is one atomic intent, unlike PATCH which sends a single field per
 * request and re-runs the whole cancel/reschedule cycle each time. `endTime` is always
 * derived from startTime + duration and is never accepted from the client.
 */
export const RescheduleContestSchema = z.object({
    startTime: z.coerce.date(),
    registrationDeadline: z.coerce.date().optional(),
    duration: z.number().int().min(10).max(480).optional(),
    reason: z.string().max(500).optional(),
    notifyParticipants: z.boolean().default(true),
}).strict().refine(
    (d) => isOnStartTimeGrid(d.startTime),
    { message: START_TIME_GRID_MESSAGE(), path: ["startTime"] }
);

// FORCE-END CONTEST

export const ForceEndContestSchema = z.object({
    reason: z.string().max(500).optional(),
}).strict();

// START CONTEST NOW

export const StartContestNowSchema = z.object({
    reason: z.string().max(500).optional(),
}).strict();

// REGISTER FOR CONTEST

export const RegisterParticipantSchema = z.object({
    contactToken: z.string().min(1),
    email: z.string().email().toLowerCase(),

    // Accept a plain 10-digit number OR an optional country-code prefix
    // (e.g. +91XXXXXXXXXX, 0091XXXXXXXXXX, 91XXXXXXXXXX).
    // The transform always strips the prefix and stores exactly 10 digits.
    phone: z
        .string()
        .min(1, "Phone number is required")
        .transform((val) => val.replace(/\D/g, ''))           // remove all non-digits
        .transform((val) => val.replace(/^(91|0{2}91)/, '')) // strip leading 91 / 0091
        .refine((val) => /^\d{10}$/.test(val), {
            message: "Phone number must be exactly 10 digits",
        }),

    firstName: z.string().min(1, "First name is required").max(100),
    lastName: z.string().min(1, "Last name is required").max(100),
    college: z.string().max(300).optional(),
    department: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    referralCode: z.string().trim().min(1).optional(),
});

export const RegisterStatusSchema = z.object({
    contactToken: z.string().min(1),
    // Optional — sent once the participant has typed a full phone number in
    // the registration details step, so a contact match found by PHONE (not
    // just by email) can also trigger the existing prefill-from-known-contact
    // behavior. Loosely validated on purpose: this is called live as the
    // user types, so an incomplete value should just skip the phone-based
    // lookup rather than 400 the whole request. See registration audit,
    // issue A.
    phone: z.string().optional(),
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
    /** Shown verbatim to participants in the cancellation notice. */
    reason: z.string().min(5).max(500),
    notifyParticipants: z.boolean().default(true),
}).strict();

export const SendContestMessageSchema = z.object({
    contestId: z.string().min(1),
    template: z.string().min(1),
    channel: z.enum(["WHATSAPP", "EMAIL"]),
});

export const UpdateContestCertificateTemplateSchema = z.object({
    certificateTemplateId: z.string().min(1)
}).strict();

export type UpdateContestCertificateTemplateInput = z.infer<typeof UpdateContestCertificateTemplateSchema>;

export type CreateContestInput = z.infer<typeof CreateContestSchema>;
export type UpdateContestInput = z.infer<typeof UpdateContestSchema>;
export type ListContestsQueryInput = z.infer<typeof ListContestsQuerySchema>;
export type RegisterParticipantInput = z.infer<typeof RegisterParticipantSchema>;
export type RegisterStatusInput = z.infer<typeof RegisterStatusSchema>;
export type AssignQuestionsInput = z.infer<typeof AssignQuestionsSchema>;
export type ReorderQuestionsInput = z.infer<typeof ReorderQuestionsSchema>;
export type GenerateCertificatesInput = z.infer<typeof GenerateCertificatesSchema>;
export type DisqualifyParticipantInput = z.infer<typeof DisqualifyParticipantSchema>;
export type CancelContestInput = z.infer<typeof CancelContestSchema>;
export type RescheduleContestInput = z.infer<typeof RescheduleContestSchema>;
export type ForceEndContestInput = z.infer<typeof ForceEndContestSchema>;
export type StartContestNowInput = z.infer<typeof StartContestNowSchema>;