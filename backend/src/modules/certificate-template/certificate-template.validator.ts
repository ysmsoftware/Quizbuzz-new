import { z } from "zod";
import { ORG_LOGO_POSITIONS, PAGE_SIZE_KEYS } from "../certificate/certificate.branding";

const orgLogoPosition = z.enum(ORG_LOGO_POSITIONS);
const pageSize        = z.enum(PAGE_SIZE_KEYS).nullable();

export const createTemplateSchema = z.object({
    name:        z.string().trim().min(1, "Name is required").max(120, "Name must be under 120 characters"),
    description: z.string().trim().max(500, "Description must be under 500 characters").optional().nullable(),
    htmlContent: z.string().min(1, "HTML content is required").max(200_000, "Template HTML must be under 200KB"),
    orgLogoPosition: orgLogoPosition.optional(),
    pageSize:        pageSize.optional(),
});

export const updateTemplateSchema = z
    .object({
        name:        z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(500).optional().nullable(),
        htmlContent: z.string().min(1).max(200_000).optional(),
        orgLogoPosition: orgLogoPosition.optional(),
        pageSize:        pageSize.optional(),
    })
    .refine((d) => Object.values(d).some((v) => v !== undefined), {
        message: "Provide at least one field to update",
    });

export const previewTemplateSchema = z
    .object({
        templateId:  z.string().trim().optional(),
        htmlContent: z.string().min(1).max(200_000).optional(),
        orgLogoPosition: orgLogoPosition.optional(),
        pageSize:        pageSize.optional(),
    })
    .refine((d) => !!d.templateId || !!d.htmlContent, {
        message: "Provide either templateId (preview a saved template) or htmlContent (preview a draft)",
    });

export const testGenerateSchema = z.object({
    participantName: z.string().trim().max(120).optional(),
    percentage:       z.coerce.number().min(0).max(100).optional(),
    rank:             z.coerce.number().int().min(1).optional(),
});

export type CreateTemplateInput  = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput  = z.infer<typeof updateTemplateSchema>;
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;
/** Named DTO (not …Input) to avoid colliding with the identically-shaped TestGenerateInput in certificate-template.types.ts, which is what the service layer actually uses. */
export type TestGenerateDTO      = z.infer<typeof testGenerateSchema>;
