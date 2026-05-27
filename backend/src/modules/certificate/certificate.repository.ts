import { CertificateStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import {
    CertificateResult,
    CreateCertificateInput,
    UpdateCertificateStatusInput,
} from "./certificate.types";

// ─── Prisma include shape (reused across every method) ────────────────────────

const CERT_INCLUDE = {
    contest: { select: { id: true, title: true } },
    participant: {
        select: {
            id:              true,
            registrationRef: true,
            contact: {
                select: { id: true, firstName: true, lastName: true, email: true },
            },
        },
    },
} satisfies Prisma.CertificateInclude;

// ─── Repository ───────────────────────────────────────────────────────────────

export class CertificateRepository {

    // ── Reads ─────────────────────────────────────────────────────────────────

    async findByIdPublic(
        id: string
    ): Promise<CertificateResult | null> {
        const row = await prisma.certificate.findFirst({
            where: { id },
            include: CERT_INCLUDE,
        });
        return row as CertificateResult | null;
    }

    async findById(
        id: string,
        organizationId: string
    ): Promise<CertificateResult | null> {
        const row = await prisma.certificate.findFirst({
            where: { id, organizationId },
            include: CERT_INCLUDE,
        });
        return row as CertificateResult | null;
    }

    async findByParticipantId(
        participantId: string,
        organizationId: string
    ): Promise<CertificateResult | null> {
        const row = await prisma.certificate.findFirst({
            where: { participantId, organizationId },
            include: CERT_INCLUDE,
        });
        return row as CertificateResult | null;
    }

    async findByContestId(
        contestId:      string,
        organizationId: string,
        skip:           number,
        take:           number
    ): Promise<CertificateResult[]> {
        const rows = await prisma.certificate.findMany({
            where: { contestId, organizationId },
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: CERT_INCLUDE,
        });
        return rows as CertificateResult[];
    }

    async countByContestId(
        contestId:      string,
        organizationId: string
    ): Promise<number> {
        return prisma.certificate.count({ where: { contestId, organizationId } });
    }

    async findByParticipantIds(
        participantIds: string[],
        organizationId: string,
        skip:           number,
        take:           number
    ): Promise<CertificateResult[]> {
        if (participantIds.length === 0) return [];
        const rows = await prisma.certificate.findMany({
            where: { participantId: { in: participantIds }, organizationId },
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: CERT_INCLUDE,
        });
        return rows as CertificateResult[];
    }

    async countByParticipantIds(
        participantIds: string[],
        organizationId: string
    ): Promise<number> {
        if (participantIds.length === 0) return 0;
        return prisma.certificate.count({
            where: { participantId: { in: participantIds }, organizationId },
        });
    }

    async findByContactAndContest(
        contactId:      string,
        contestId:      string,
        organizationId: string
    ): Promise<CertificateResult | null> {
        // contestId scopes the org — single join, not a 3-table chain
        const row = await prisma.certificate.findFirst({
            where: {
                contestId,
                organizationId,
                participant: { contactId },
            },
            include: CERT_INCLUDE,
        });
        return row as CertificateResult | null;
    }

    /**
     * Fetches all eligible participants in a contest who do NOT yet have a
     * certificate row. "Eligible" = SUBMITTED status + EVALUATED submission.
     * Used by bulk issue to know exactly who to create rows for.
     */
    async findEligibleParticipantsWithoutCertificate(
        contestId:      string,
        organizationId: string
    ) {
        return prisma.participant.findMany({
            where: {
                contestId,
                organizationId,
                status:      "SUBMITTED",
                submission:  { status: "EVALUATED" },
                certificate: null,               // no cert row yet
            },
            include: {
                contact: {
                    select: { firstName: true, lastName: true, email: true },
                },
                submission: {
                    select: { score: true, percentage: true, timeTakenSecs: true },
                },
                leaderboard: {
                    select: { rank: true },
                },
                contest: {
                    select: { title: true },
                },
            },
        });
    }

    /**
     * Fetches failed certificates for a contest to re-queue them.
     * Returns full rows so the service can rebuild the job payload.
     */
    async findFailedByContestId(
        contestId:      string,
        organizationId: string
    ): Promise<CertificateResult[]> {
        const rows = await prisma.certificate.findMany({
            where: { contestId, organizationId, status: "FAILED" },
            include: CERT_INCLUDE,
        });
        return rows as CertificateResult[];
    }

    async findFailedByOrganization(
        organizationId: string
    ): Promise<CertificateResult[]> {
        const rows = await prisma.certificate.findMany({
            where: { organizationId, status: "FAILED" },
            include: CERT_INCLUDE,
        });
        return rows as CertificateResult[];
    }

    // ── Writes ────────────────────────────────────────────────────────────────

    async create(input: CreateCertificateInput): Promise<CertificateResult> {
        const row = await prisma.certificate.create({
            data: {
                organizationId: input.organizationId,
                contestId:      input.contestId,
                participantId:  input.participantId,
                status:         "QUEUED",
                metadata:       (input.metadata as any) ?? null,
            },
            include: CERT_INCLUDE,
        });
        return row as CertificateResult;
    }

    /**
     * Bulk-create certificate rows for multiple participants in one transaction.
     * Skips duplicates via skipDuplicates — idempotent on re-run.
     */
    async bulkCreate(
        rows: CreateCertificateInput[]
    ): Promise<{ count: number }> {
        if (rows.length === 0) return { count: 0 };
        const result = await prisma.certificate.createMany({
            data: rows.map((r) => ({
                organizationId: r.organizationId,
                contestId:      r.contestId,
                participantId:  r.participantId,
                status:         "QUEUED" as CertificateStatus,
                metadata:       (r.metadata as any) ?? null,
            })),
            skipDuplicates: true,
        });
        return { count: result.count };
    }

    /**
     * Forward-only status update. The caller is responsible for checking
     * the transition is valid — repository does the raw write.
     */
    async updateStatus(
        id:             string,
        organizationId: string,
        input:          UpdateCertificateStatusInput
    ): Promise<CertificateResult> {
        const row = await prisma.certificate.update({
            where: { id },
            data: {
                organizationId,        // org scope enforced at write time too
                status:         input.status,
                fileUrl:        input.fileUrl        ?? null,
                fileKey:        input.fileKey        ?? null,
                generatedAt:    input.generatedAt    ?? null,
                deliveredAt:    input.deliveredAt    ?? null,
                ...(input.failureReason
                    ? { metadata: { failureReason: input.failureReason } as any }
                    : {}),
                updatedAt: new Date(),
            },
            include: CERT_INCLUDE,
        });
        return row as CertificateResult;
    }

    /**
     * Batch-reset FAILED certificates to QUEUED.
     * Returns count so the service knows how many to enqueue.
     */
    async resetFailedToQueued(
        organizationId: string,
        contestId?:     string
    ): Promise<number> {
        const result = await prisma.certificate.updateMany({
            where: {
                organizationId,
                status: "FAILED",
                ...(contestId ? { contestId } : {}),
            },
            data: { status: "QUEUED", updatedAt: new Date() },
        });
        return result.count;
    }

    async getStatusSummary(
        contestId:      string,
        organizationId: string
    ): Promise<{ generated: number; failed: number; pending: number }> {
        const counts = await prisma.certificate.groupBy({
            by: ["status"],
            where: { contestId, organizationId },
            _count: { status: true },
        });

        const summary = {
            generated: 0,
            failed: 0,
            pending: 0,
        };

        for (const item of counts) {
            const status = item.status;
            const count = item._count.status;
            if (status === "GENERATED" || status === "DELIVERED") {
                summary.generated += count;
            } else if (status === "FAILED") {
                summary.failed += count;
            } else if (status === "PENDING" || status === "QUEUED" || status === "GENERATING") {
                summary.pending += count;
            }
        }

        return summary;
    }

    async findMergedParticipantsWithCertificates(
        contestId:      string,
        organizationId: string,
        skip:           number,
        take:           number,
        search?:        string,
        status?:        string
    ): Promise<any[]> {
        const where: Prisma.ParticipantWhereInput = {
            contestId,
            organizationId,
        };

        if (search && search.trim()) {
            const query = search.trim();
            where.OR = [
                { id: { contains: query, mode: "insensitive" } },
                { registrationRef: { contains: query, mode: "insensitive" } },
                { contact: { email: { contains: query, mode: "insensitive" } } },
                { contact: { firstName: { contains: query, mode: "insensitive" } } },
                { contact: { lastName: { contains: query, mode: "insensitive" } } },
            ];
        }

        if (status && status !== "all") {
            if (status === "NOT_GENERATED") {
                where.certificate = null;
            } else {
                where.certificate = {
                    status: status as CertificateStatus,
                };
            }
        }

        const participants = await prisma.participant.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: "asc" },
            include: {
                contact: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                certificate: {
                    select: {
                        id: true,
                        status: true,
                        fileUrl: true,
                        generatedAt: true,
                        deliveredAt: true,
                    },
                },
            },
        });

        return participants.map((p) => ({
            participant: {
                id: p.id,
                registrationRef: p.registrationRef,
                status: p.status,
                contact: {
                    firstName: p.contact.firstName,
                    lastName: p.contact.lastName,
                    email: p.contact.email,
                },
            },
            certificate: p.certificate ? {
                id: p.certificate.id,
                status: p.certificate.status,
                fileUrl: p.certificate.fileUrl,
                generatedAt: p.certificate.generatedAt,
                deliveredAt: p.certificate.deliveredAt,
            } : null,
            certStatus: p.certificate ? p.certificate.status : "NOT_GENERATED",
        }));
    }

    async countMergedParticipantsWithCertificates(
        contestId:      string,
        organizationId: string,
        search?:        string,
        status?:        string
    ): Promise<number> {
        const where: Prisma.ParticipantWhereInput = {
            contestId,
            organizationId,
        };

        if (search && search.trim()) {
            const query = search.trim();
            where.OR = [
                { id: { contains: query, mode: "insensitive" } },
                { registrationRef: { contains: query, mode: "insensitive" } },
                { contact: { email: { contains: query, mode: "insensitive" } } },
                { contact: { firstName: { contains: query, mode: "insensitive" } } },
                { contact: { lastName: { contains: query, mode: "insensitive" } } },
            ];
        }

        if (status && status !== "all") {
            if (status === "NOT_GENERATED") {
                where.certificate = null;
            } else {
                where.certificate = {
                    status: status as CertificateStatus,
                };
            }
        }

        return prisma.participant.count({ where });
    }
}

