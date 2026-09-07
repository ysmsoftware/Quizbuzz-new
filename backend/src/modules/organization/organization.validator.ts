import { z } from "zod";
import { OrgMemberRole } from "@prisma/client";

export const updateOrganizationSchema = z.object({
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name cannot exceed 100 characters")
        .optional(),
    logoUrl: z.string().url("Must be a valid URL").nullable().optional(),
});

export const inviteMemberSchema = z.object({
    email: z.preprocess(
        (val) => (Array.isArray(val) ? val[0] : val),
        z.string().email("Must be a valid email address")
    ),
    role: z.nativeEnum(OrgMemberRole, {
        message: "Role must be OWNER, ADMIN, or VIEWER",
    }),
});

export const updateMemberRoleSchema = z.object({
    role: z.nativeEnum(OrgMemberRole, {
        message: "Role must be OWNER, ADMIN, or VIEWER",
    }),
});

export const acceptInviteSchema = z.object({
    token: z.string().min(1, "Invite token is required"),
    firstName: z.string().min(1, "First name is required").optional(),
    lastName: z.string().min(1, "Last name is required").optional(),
    password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

import {
    OrgPrimaryUseCase,
    OrgSizeBucket,
    ExpectedContestVolume,
    ExpectedParticipantVolume,
    HeardAboutSource,
} from "@prisma/client";

export const updateOrganizationProfileSchema = z.object({
    primaryUseCase:           z.nativeEnum(OrgPrimaryUseCase).nullable().optional(),
    useCaseOther:             z.string().max(200).nullable().optional(),
    sizeBucket:               z.nativeEnum(OrgSizeBucket).nullable().optional(),
    expectedContestsPerMonth: z.nativeEnum(ExpectedContestVolume).nullable().optional(),
    expectedParticipants:     z.nativeEnum(ExpectedParticipantVolume).nullable().optional(),
    heardAboutSource:         z.nativeEnum(HeardAboutSource).nullable().optional(),
    heardAboutOther:          z.string().max(200).nullable().optional(),
    primaryContactName:       z.string().max(150).nullable().optional(),
    primaryContactPhone:      z.string().max(20).nullable().optional(),
    primaryContactEmail:      z.union([z.string().email().max(200), z.literal(""), z.null()]).optional(),
    country:                  z.string().max(100).nullable().optional(),
    state:                    z.string().max(100).nullable().optional(),
    city:                     z.string().max(100).nullable().optional(),
    timezone:                 z.string().max(100).nullable().optional(),
    preferredCurrency:        z.string().length(3).nullable().optional(),
    gstNumber:                z.string().max(20).nullable().optional(),
    billingAddress:           z.string().max(500).nullable().optional(),
    marketingOptIn:           z.boolean().nullable().optional(),
});

export type UpdateOrganizationProfileInput = z.infer<typeof updateOrganizationProfileSchema>;