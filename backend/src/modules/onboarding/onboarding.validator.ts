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
    logoUrl: z.string().url("Logo URL must be a valid URL").max(500).optional(),
    website: z.string().url("Website must be a valid URL").max(500).optional(),
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

// ─── ATTRIBUTION step ─────────────────────────────────────────────────────────

export const AttributionStepSchema = z
    .object({
        heardAboutSource: z.nativeEnum(HeardAboutSource),
        heardAboutOther:  z.string().max(200).optional(),
        marketingOptIn:   z.boolean().default(false),
    })
    .refine(
        (d) => d.heardAboutSource !== HeardAboutSource.OTHER || !!d.heardAboutOther?.trim(),
        { message: "Please describe how you heard about us", path: ["heardAboutOther"] }
    );

// ─── CONTACT_LOCALE step ──────────────────────────────────────────────────────

export const ContactLocaleStepSchema = z.object({
    primaryContactName:  z.string().max(150).optional(),
    primaryContactPhone: z.string().max(20).optional(),
    primaryContactEmail: z.string().email().max(200).optional(),
    country:             z.string().max(100).optional(),
    state:               z.string().max(100).optional(),
    city:                z.string().max(100).optional(),
    timezone:            z.string().max(100).optional(),
    preferredCurrency:   z.string().length(3).default("INR"),
    gstNumber:           z.string().max(20).optional(),
    billingAddress:      z.string().max(500).optional(),
});

// ─── PLAN_SELECTION step (stub) ───────────────────────────────────────────────

export const PlanSelectionStepSchema = z.object({
    planSlug: z.enum(["free"]),
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
