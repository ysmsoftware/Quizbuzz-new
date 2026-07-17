import { z } from "zod";
import { OrgMemberRole } from "@prisma/client";

export const updateOrganizationSchema = z.object({
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name cannot exceed 100 characters")
        .optional(),
    logoUrl: z.string().url("Must be a valid URL").optional(),
    website: z.string().url("Must be a valid URL").optional(),
});

export const inviteMemberSchema = z.object({
    email: z.string().email("Must be a valid email address"),
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
    primaryUseCase:           z.nativeEnum(OrgPrimaryUseCase).optional(),
    useCaseOther:             z.string().max(200).optional(),
    sizeBucket:               z.nativeEnum(OrgSizeBucket).optional(),
    expectedContestsPerMonth: z.nativeEnum(ExpectedContestVolume).optional(),
    expectedParticipants:     z.nativeEnum(ExpectedParticipantVolume).optional(),
    heardAboutSource:         z.nativeEnum(HeardAboutSource).optional(),
    heardAboutOther:          z.string().max(200).optional(),
    primaryContactName:       z.string().max(150).optional(),
    primaryContactPhone:      z.string().max(20).optional(),
    primaryContactEmail:      z.string().email().max(200).optional(),
    country:                  z.string().max(100).optional(),
    state:                    z.string().max(100).optional(),
    city:                     z.string().max(100).optional(),
    timezone:                 z.string().max(100).optional(),
    preferredCurrency:        z.string().length(3).optional(),
    gstNumber:                z.string().max(20).optional(),
    billingAddress:           z.string().max(500).optional(),
    marketingOptIn:           z.boolean().optional(),
});

export type UpdateOrganizationProfileInput = z.infer<typeof updateOrganizationProfileSchema>;