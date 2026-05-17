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