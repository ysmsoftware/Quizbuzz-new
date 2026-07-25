import { z } from "zod";
import {
    OrgPrimaryUseCase,
    OrgSizeBucket,
    ExpectedContestVolume,
    ExpectedParticipantVolume,
    HeardAboutSource,
} from "@prisma/client";

// ─── IDENTITY step ────────────────────────────────────────────────────────────

export const IdentityStepSchema = z.object({
    name: z.string().min(2, "Organization name must be at least 2 characters").max(150),
});

// ─── USE_CASE step ────────────────────────────────────────────────────────────

export const UseCaseStepSchema = z
    .object({
        primaryUseCase:           z.nativeEnum(OrgPrimaryUseCase),
        useCaseOther:             z.string().max(200).optional(),
        sizeBucket:               z.nativeEnum(OrgSizeBucket),
        expectedContestsPerMonth: z.nativeEnum(ExpectedContestVolume),
        expectedParticipants:     z.nativeEnum(ExpectedParticipantVolume),
    })
    .refine(
        (d) => d.primaryUseCase !== OrgPrimaryUseCase.OTHER || !!d.useCaseOther?.trim(),
        { message: "Please describe your use case", path: ["useCaseOther"] }
    );

// ─── ATTRIBUTION step (legacy / standalone schema) ────────────────────────────

export const AttributionStepSchema = z
    .object({
        heardAboutSource: z.nativeEnum(HeardAboutSource).optional(),
        heardAboutOther:  z.string().max(200).optional(),
        marketingOptIn:   z.boolean().default(false),
    })
    .refine(
        (d) => !d.heardAboutSource || d.heardAboutSource !== HeardAboutSource.OTHER || !!d.heardAboutOther?.trim(),
        { message: "Please describe how you heard about us", path: ["heardAboutOther"] }
    );

// ─── CONTACT_LOCALE step (includes contact, region & attribution) ─────────────

export const ContactLocaleStepSchema = z.object({
    primaryContactName:  z.string().max(150).optional(),
    primaryContactPhone: z.string().max(20).optional(),
    primaryContactEmail: z.string().email().max(200).optional().or(z.literal("")),
    country:             z.string().max(100).optional(),
    state:               z.string().max(100).optional(),
    city:                z.string().max(100).optional(),
    timezone:            z.string().max(100).optional(),
    heardAboutSource:    z.nativeEnum(HeardAboutSource).optional(),
    heardAboutOther:     z.string().max(200).optional(),
    marketingOptIn:      z.boolean().optional(),
});

// ─── PLAN_SELECTION step (stub) ───────────────────────────────────────────────

export const PlanSelectionStepSchema = z.object({
    planSlug: z.string().min(1, "Please select a plan"),
});

// ─── Per-step schema lookup ───────────────────────────────────────────────────

export const STEP_SCHEMAS = {
    IDENTITY:        IdentityStepSchema,
    USE_CASE:        UseCaseStepSchema,
    ATTRIBUTION:     AttributionStepSchema,
    CONTACT_LOCALE:  ContactLocaleStepSchema,
    PLAN_SELECTION:  PlanSelectionStepSchema,
} as const;

export type StepName = keyof typeof STEP_SCHEMAS;

