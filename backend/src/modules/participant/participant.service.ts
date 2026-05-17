import { IParticipantRepository } from "./participant.repository";
import { ContestRepository } from "../contest/contest.repository";
import { NotFoundError, ConflictError } from "../../error/http-errors";
import { FindAllParticipantsOptions } from "./participant.types";

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

        return this.participantRepo.disqualify(participantId, organizationId);
    }

    async registerParticipant(input: {
        organizationId: string;
        contestId: string;
        contactId: string;
        registrationRef: string;
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
}
