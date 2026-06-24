import { IParticipantRepository } from "./participant.repository";
import { ContestRepository } from "../contest/contest.repository";
import { NotFoundError, ConflictError } from "../../error/http-errors";
import { FindAllParticipantsOptions } from "./participant.types";
import { redis } from "../../config/redis";
import { ParticipantStatus } from "@prisma/client";
import { prisma } from "../../config/db";
import { exportQueue } from "../../queues";

export class ParticipantService {
    constructor(
        private readonly participantRepo: IParticipantRepository,
        private readonly contestRepo: ContestRepository
    ) {}

    async getParticipants(
        organizationId: string,
        contestId: string,
        query: FindAllParticipantsOptions
    ) {
        // Ownership check: Ensure contest belongs to organization
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) {
            throw new NotFoundError("Contest not found");
        }

        const { participants, total } = await this.participantRepo.findAll(organizationId, contestId, query);
        return {
            participants,
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit),
            },
        };
    }

    async getParticipantById(contestId: string, participantId: string, organizationId?: string) {
        const participant = await this.participantRepo.findById(contestId, participantId, organizationId);
        if (!participant) {
            throw new NotFoundError("Participant not found");
        }

        return participant;
    }

    async disqualifyParticipant(contestId: string, participantId: string, organizationId: string, reason?: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) {
            throw new NotFoundError("Contest not found");
        }

        const participant = await this.participantRepo.findById(contestId, participantId, organizationId);
        if (!participant) {
            throw new NotFoundError("Participant not found");
        }

        // Additional business logic for disqualification could go here

        const result = await this.participantRepo.disqualify(participantId, organizationId);
        try {
            await redis.del(`contest:status-summary:${contestId}`);
        } catch (e) {
            console.error("Failed to invalidate Redis cache in disqualifyParticipant:", e);
        }
        return result;
    }

    async registerParticipant(input: {
        organizationId: string;
        contestId: string;
        contactId: string;
        registrationRef: string;
        status?: ParticipantStatus;
    }) {
        const contest = await this.contestRepo.findById(input.contestId, input.organizationId);
        if (!contest) {
            throw new NotFoundError("Contest not found");
        }

        // Check if already registered
        const alreadyRegistered = await this.participantRepo.findByContactId(
            input.organizationId,
            input.contestId,
            input.contactId
        );

        if (alreadyRegistered) {
            throw new ConflictError("Participant is already registered for this contest");
        }

        return this.participantRepo.create(input);
    }

    /**
     * Called by the payment webhook after a successful payment.captured event.
     * Transitions the participant from PENDING_PAYMENT → REGISTERED,
     * confirming their seat in the contest.
     */
    async confirmPaymentRegistration(participantId: string): Promise<void> {
        try {
            await this.participantRepo.updateStatus(participantId, ParticipantStatus.REGISTERED);
        } catch (err) {
            // Log but don't throw — the payment is already captured; a status-update
            // failure should not cause the webhook to return an error (which would
            // trigger Razorpay retries).
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[participant] Failed to confirm payment registration for ${participantId}: ${msg}`);
        }
    }

    async getEligibleForCertificate(contestId: string, organizationId: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) {
            throw new NotFoundError("Contest not found");
        }
        
        return this.participantRepo.findEligibleForCertificate(contestId, organizationId);
    }
    
    async getIdsByContactId(contactId: string, organizationId: string) {
        return this.participantRepo.findIdsByContactId(contactId, organizationId);
    }
    
    async getIdByContactAndContest(contactId: string, contestId: string, organizationId: string) {
        return this.participantRepo.findIdByContactAndContest(contactId, contestId, organizationId);
    }
    
    async getContestIdByParticipantId(participantId: string, organizationId: string) {
        return this.participantRepo.findContestIdByParticipantId(participantId, organizationId);
    }

    async getStatusSummary(organizationId: string, contestId: string) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) {
            throw new NotFoundError("Contest not found");
        }

        const cacheKey = `contest:status-summary:${contestId}`;
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            console.error("Failed to get from Redis cache:", e);
        }

        const summary = await this.participantRepo.getStatusSummary(contestId, organizationId);

        try {
            await redis.set(cacheKey, JSON.stringify(summary), "EX", 30);
        } catch (e) {
            console.error("Failed to write to Redis cache:", e);
        }

        return summary;
    }

    async bulkStatusOverride(
        organizationId: string,
        contestId: string,
        participantIds: string[],
        status: "REGISTERED" | "DISQUALIFIED"
    ): Promise<{ updatedCount: number }> {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) {
            throw new NotFoundError("Contest not found");
        }

        const prismaStatus = status as ParticipantStatus;
        const batchSize = 500;
        let updatedCount = 0;

        for (let i = 0; i < participantIds.length; i += batchSize) {
            const batch = participantIds.slice(i, i + batchSize);
            
            const count = await this.participantRepo.updateStatuses(batch, prismaStatus, organizationId);
            updatedCount += count;

            if (i + batchSize < participantIds.length) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }

        try {
            const cacheKey = `contest:status-summary:${contestId}`;
            await redis.del(cacheKey);
        } catch (e) {
            console.error("Failed to invalidate Redis cache in bulkStatusOverride:", e);
        }

        return { updatedCount };
    }

    async triggerExport(
        organizationId: string,
        contestId: string,
        adminId: string,
        format: "csv" | "pdf",
        filters: any
    ) {
        const contest = await this.contestRepo.findById(contestId, organizationId);
        if (!contest) {
            throw new NotFoundError("Contest not found");
        }

        const exportLog = await prisma.exportLog.create({
            data: {
                organizationId,
                contestId,
                adminId,
                format,
                filters
            }
        });

        await exportQueue.add("export-job", { exportId: exportLog.id });

        return exportLog;
    }

    async getExportStatus(organizationId: string, contestId: string, exportId: string) {
        const exportLog = await prisma.exportLog.findUnique({
            where: { id: exportId }
        });

        if (!exportLog || exportLog.organizationId !== organizationId || exportLog.contestId !== contestId) {
            throw new NotFoundError("Export log not found");
        }

        return exportLog;
    }
}
