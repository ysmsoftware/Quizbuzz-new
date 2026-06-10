import { CertificateRepository } from "./certificate.repository";
import { ParticipantRepository } from "../participant/participant.repository";
import { certificateQueue } from "../../queues";
import { NotFoundError, BadRequestError, ConflictError } from "../../error/http-errors";
import {
    CertificateJobPayload,
    CertificateMetadata,
    CertificateResult,
    IssueCertificateDTO,
    PaginatedCertificatesResult,
    UpdateCertificateStatusInput,
} from "./certificate.types";
import logger from "../../config/logger";

export class CertificateService {
    constructor(
        private readonly certificateRepo: CertificateRepository,
        private readonly participantRepo: ParticipantRepository,
    ) { }

    // ── Reads ─────────────────────────────────────────────────────────────────

    async getCertificateByIdPublic(
        id: string
    ): Promise<CertificateResult> {
        const cert = await this.certificateRepo.findByIdPublic(id);
        if (!cert) throw new NotFoundError("Certificate not found");
        return cert;
    }

    async getCertificateById(
        id: string,
        organizationId: string
    ): Promise<CertificateResult> {
        const cert = await this.certificateRepo.findById(id, organizationId);
        if (!cert) throw new NotFoundError("Certificate not found");
        return cert;
    }

    /**
     * All certificates for a contact across all contests.
     * Admin contact-profile view.
     */
    async getCertificatesByContact(
        contactId: string,
        organizationId: string,
        page: number,
        limit: number
    ): Promise<PaginatedCertificatesResult> {
        const skip = (page - 1) * limit;

        // Resolve participantIds first — no cross-domain join in the cert repo
        const participantIds = await this.participantRepo.findIdsByContactId(
            contactId,
            organizationId
        );

        if (participantIds.length === 0) {
            return { data: [], total: 0, page, limit, totalPages: 0 };
        }

        const [rows, total] = await Promise.all([
            this.certificateRepo.findByParticipantIds(participantIds, organizationId, skip, limit),
            this.certificateRepo.countByParticipantIds(participantIds, organizationId),
        ]);

        return { data: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    /** All certificates for a contest — admin contest-level view */
    async getCertificatesByContest(
        contestId:      string,
        organizationId: string,
        page:           number,
        limit:          number,
        search?:        string,
        status?:        string
    ): Promise<any> {
        const skip = (page - 1) * limit;

        const [rows, total, summary] = await Promise.all([
            this.certificateRepo.findMergedParticipantsWithCertificates(contestId, organizationId, skip, limit, search, status),
            this.certificateRepo.countMergedParticipantsWithCertificates(contestId, organizationId, search, status),
            this.certificateRepo.getStatusSummary(contestId, organizationId),
        ]);

        return {
            data: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
            summary,
        };
    }


    /** Single certificate for a specific contact in a specific contest */
    async getCertificateByContactAndContest(
        contactId: string,
        contestId: string,
        organizationId: string
    ): Promise<CertificateResult> {
        const cert = await this.certificateRepo.findByContactAndContest(
            contactId,
            contestId,
            organizationId
        );
        if (!cert) throw new NotFoundError("Certificate not found for this contact in this contest");
        return cert;
    }

    // ── Issue — single ────────────────────────────────────────────────────────

    /**
     * Issue a certificate to a single participant.
     *
     * Resolution order for participantId:
     *   1. dto.participantId — direct
     *   2. dto.contactId + dto.contestId — lookup via participant repo
     *
     * Idempotent:
     *   - Already GENERATED / QUEUED / GENERATING → return existing (no duplicate)
     *   - Already FAILED → re-queue (retry flow)
     *   - Already PENDING → re-queue
     */
    async issueCertificate(
        dto: IssueCertificateDTO,
        organizationId: string
    ): Promise<CertificateResult> {
        // 1. Resolve participantId
        const participantId = await this._resolveParticipantId(dto, organizationId);

        // 2. Load participant with submission + leaderboard data for metadata
        const participant = await this.participantRepo.findById(
            "",   // contestId not needed — findById uses participantId + orgId
            participantId,
            organizationId
        );
        if (!participant) throw new NotFoundError("Participant not found");

        if (participant.status !== "SUBMITTED") {
            throw new BadRequestError(
                `Cannot issue certificate: participant status is "${participant.status}". ` +
                `Only SUBMITTED participants are eligible.`
            );
        }

        // 3. Check if evaluation is complete — certificates must reflect the final score
        if (!participant.submission || participant.submission.status !== "EVALUATED") {
            throw new BadRequestError(
                "Cannot issue certificate: submission has not been evaluated yet"
            );
        }

        // 4. Check for existing certificate
        const existing = await this.certificateRepo.findByParticipantId(
            participantId,
            organizationId
        );

        if (existing) {
            if (existing.status === "GENERATED" || existing.status === "DELIVERING" as any) {
                // Already done — return as-is
                return existing;
            }
            if (existing.status === "QUEUED" || existing.status === "GENERATING") {
                // In progress — return current state
                logger.info(
                    `[CertificateService.issueCertificate] Certificate ${existing.id} already in progress (${existing.status})`
                );
                return existing;
            }
            if (existing.status === "FAILED" || existing.status === "PENDING") {
                // Re-queue failed or stale pending
                return this._requeueCertificate(existing.id, organizationId, existing);
            }
        }

        // 5. Build metadata from submission + leaderboard data
        const metadata: CertificateMetadata = {
            participantName: `${participant.contact.firstName} ${participant.contact.lastName ?? ""}`.trim(),
            contestTitle: participant.contest?.title ?? "",
            // contestDate: the actual event date (startTime), not the issuance date
            contestDate: participant.contest?.startTime?.toISOString() ?? new Date().toISOString(),
            score: participant.submission.score ? Number(participant.submission.score) : undefined,
            percentage: participant.submission.percentage ? Number(participant.submission.percentage) : undefined,
            rank: participant.leaderboard?.rank ?? undefined,
            timeTakenSecs: participant.submission.timeTakenSecs ?? undefined,
            issuedAt: new Date().toISOString(),
            // Org branding fields — orgLogoUrl and primaryColor are left unset here
            // so the template defaults (QuizBuzz navy) are used. These can be set
            // per-contest in the future by storing them on the Contest model.
        };

        // 6. Create certificate row in QUEUED status
        const cert = await this.certificateRepo.create({
            organizationId,
            contestId: participant.contestId,
            participantId,
            metadata,
        });

        // 7. Enqueue generation job
        await this._enqueueGeneration(cert, organizationId, metadata);

        logger.info(
            `[CertificateService.issueCertificate] Certificate ${cert.id} queued for participant ${participantId}`
        );

        return cert;
    }

    // ── Issue — bulk ──────────────────────────────────────────────────────────

    /**
     * Issue certificates to ALL eligible participants of a contest.
     * "Eligible" = SUBMITTED status + EVALUATED submission + no existing cert.
     *
     * Flow:
     *   1. Fetch all eligible participants without a cert row
     *   2. Bulk-create certificate rows (one DB round trip)
     *   3. Bulk-enqueue generation jobs (one Redis pipeline)
     *
     * Idempotent — skipDuplicates in bulkCreate prevents double rows.
     */
    async bulkIssueCertificates(
        contestId: string,
        organizationId: string
    ): Promise<{ queued: number; skipped: number }> {
        // 1. Find all eligible participants without a certificate
        const eligible = await this.certificateRepo
            .findEligibleParticipantsWithoutCertificate(contestId, organizationId);

        if (eligible.length === 0) {
            logger.info(
                `[CertificateService.bulkIssueCertificates] No eligible participants for contest ${contestId}`
            );
            return { queued: 0, skipped: 0 };
        }

        // 2. Build create inputs with metadata for each participant
        const contestTitle = eligible[0]?.contest?.title ?? "";

        const createInputs = eligible.map((p) => ({
            organizationId,
            contestId,
            participantId: p.id,
            metadata: {
                participantName: `${p.contact.firstName} ${p.contact.lastName ?? ""}`.trim(),
                contestTitle,
                contestDate: (p as any).contest?.startTime?.toISOString() ?? new Date().toISOString(),
                score: p.submission?.score ? Number(p.submission.score) : undefined,
                percentage: p.submission?.percentage ? Number(p.submission.percentage) : undefined,
                rank: p.leaderboard?.rank ?? undefined,
                timeTakenSecs: p.submission?.timeTakenSecs ?? undefined,
                issuedAt: new Date().toISOString(),
            } as any,
        }));

        // 3. Bulk-create rows — one transaction
        const { count } = await this.certificateRepo.bulkCreate(createInputs);

        // 4. Fetch the newly created cert IDs to build queue payloads
        //    We need the IDs that were just inserted — bulk create doesn't return them.
        //    Fetch by contestId + status=QUEUED + participantId IN eligible list.
        const newCerts = await this.certificateRepo.findByContestId(
            contestId,
            organizationId,
            0,
            eligible.length   // enough to cover all
        );
        const queuedCerts = newCerts.filter((c) => c.status === "QUEUED");

        // 5. Bulk-enqueue — single Redis pipeline
        if (queuedCerts.length > 0) {
            await certificateQueue.addBulk(
                queuedCerts.map((cert) => ({
                    name: "generate-certificate",
                    data: {
                        certificateId: cert.id,
                        organizationId,
                        contestId,
                        participantId: cert.participantId,
                        metadata: (cert.metadata as CertificateMetadata) ??
                            createInputs.find(i => i.participantId === cert.participantId)!.metadata,
                    } satisfies CertificateJobPayload,
                    opts: { jobId: cert.id },
                }))
            );
        }

        logger.info(
            `[CertificateService.bulkIssueCertificates] Contest ${contestId}: ${count} rows created, ${queuedCerts.length} jobs enqueued`
        );

        return { queued: queuedCerts.length, skipped: eligible.length - count };
    }

    // ── Retry ─────────────────────────────────────────────────────────────────

    /** Retry/Re-run any certificate generation job */
    async retryCertificate(
        id: string,
        organizationId: string
    ): Promise<CertificateResult> {
        const cert = await this.certificateRepo.findById(id, organizationId);
        if (!cert) throw new NotFoundError("Certificate not found");

        // Allow retrying/re-running certificates in any status (FAILED, QUEUED, GENERATING, or GENERATED)
        return this._requeueCertificate(id, organizationId, cert);
    }

    /**
     * Retry all FAILED certificates for an organization (optionally scoped to a contest).
     * Fetches IDs, resets status to QUEUED, then bulk-enqueues.
     */
    async retryFailedCertificates(
        organizationId: string,
        contestId?: string
    ): Promise<{ count: number }> {
        // Fetch before reset so we have metadata for the job payload
        const failed = contestId
            ? await this.certificateRepo.findFailedByContestId(contestId, organizationId)
            : await this.certificateRepo.findFailedByOrganization(organizationId);

        if (failed.length === 0) {
            return { count: 0 };
        }

        // Batch-reset to QUEUED
        const count = await this.certificateRepo.resetFailedToQueued(organizationId, contestId);

        // Bulk-enqueue
        await certificateQueue.addBulk(
            failed.map((cert) => ({
                name: "generate-certificate",
                data: {
                    certificateId: cert.id,
                    organizationId,
                    contestId: cert.contestId,
                    participantId: cert.participantId,
                    metadata: cert.metadata as CertificateMetadata,
                } satisfies CertificateJobPayload,
                opts: { jobId: cert.id },
            }))
        );

        logger.info(
            `[CertificateService.retryFailedCertificates] Retrying ${count} failed certificates`
        );

        return { count };
    }

    // ── Internal — called by worker ───────────────────────────────────────────

    /**
     * Called by certificate.worker after successful PDF generation + upload.
     * Moves status → GENERATED and stores fileUrl + fileKey.
     */
    async markGenerated(
        certificateId: string,
        organizationId: string,
        fileUrl: string,
        fileKey: string
    ): Promise<void> {
        await this.certificateRepo.updateStatus(certificateId, organizationId, {
            status: "GENERATED",
            fileUrl,
            fileKey,
            generatedAt: new Date(),
        });

        logger.info(
            `[CertificateService.markGenerated] Certificate ${certificateId} generated → ${fileUrl}`
        );
    }

    /**
     * Called by certificate.worker on generation failure.
     * Moves status → FAILED and stores the failure reason in metadata.
     */
    async markFailed(
        certificateId: string,
        organizationId: string,
        reason: string
    ): Promise<void> {
        await this.certificateRepo.updateStatus(certificateId, organizationId, {
            status: "FAILED",
            failureReason: reason,
        });

        logger.warn(
            `[CertificateService.markFailed] Certificate ${certificateId} failed: ${reason}`
        );
    }

    /**
     * Called by certificate.worker when it picks up a job (before Puppeteer runs).
     * Moves status QUEUED → GENERATING so the admin can see it's in progress.
     */
    async markGenerating(
        certificateId: string,
        organizationId: string
    ): Promise<void> {
        await this.certificateRepo.updateStatus(certificateId, organizationId, {
            status: "GENERATING",
        });
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async _resolveParticipantId(
        dto: IssueCertificateDTO,
        organizationId: string
    ): Promise<string> {
        if (dto.participantId) {
            const participant = await this.participantRepo.findById(
                "",
                dto.participantId,
                organizationId
            );
            if (!participant) throw new NotFoundError("Participant not found");
            return participant.id;
        }

        if (dto.contactId && dto.contestId) {
            const id = await this.participantRepo.findIdByContactAndContest(
                dto.contactId,
                dto.contestId,
                organizationId
            );
            if (!id) throw new NotFoundError("Participant not found for this contact in this contest");
            return id;
        }

        throw new BadRequestError(
            "Provide either participantId, or both contactId and contestId"
        );
    }

    private async _requeueCertificate(
        id: string,
        organizationId: string,
        cert: CertificateResult
    ): Promise<CertificateResult> {
        const updated = await this.certificateRepo.updateStatus(id, organizationId, {
            status: "QUEUED",
        });

        await this._enqueueGeneration(updated, organizationId, cert.metadata as CertificateMetadata);

        logger.info(`[CertificateService] Certificate ${id} re-queued`);
        return updated;
    }

    private async _enqueueGeneration(
        cert: CertificateResult,
        organizationId: string,
        metadata: CertificateMetadata
    ): Promise<void> {
        await certificateQueue.add(
            "generate-certificate",
            {
                certificateId: cert.id,
                organizationId,
                contestId: cert.contestId,
                participantId: cert.participantId,
                metadata,
            } satisfies CertificateJobPayload,
            { jobId: cert.id }   // deduplication key
        );
    }
}
