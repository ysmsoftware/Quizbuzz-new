import { z } from "zod";

// ─── Issue single certificate ─────────────────────────────────────────────────

export const issueCertificateSchema = z
    .object({
        participantId: z.string().trim().optional(),
        contactId:     z.string().trim().optional(),
        contestId:     z.string().trim().optional(),
    })
    .refine(
        (d) => !!d.participantId || (!!d.contactId && !!d.contestId),
        { message: "Provide either participantId, or both contactId and contestId" }
    );

// ─── Bulk issue for a whole contest ──────────────────────────────────────────

export const bulkIssueCertificateSchema = z.object({
    contestId: z.string().trim().min(1, "contestId is required"),
});

// ─── Pagination ───────────────────────────────────────────────────────────────

export const certificatePaginationSchema = z.object({
    page:  z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type IssueCertificateInput  = z.infer<typeof issueCertificateSchema>;
export type BulkIssueCertificateInput = z.infer<typeof bulkIssueCertificateSchema>;
export type CertificatePaginationQuery = z.infer<typeof certificatePaginationSchema>;
