import { Participant, Prisma, ParticipantStatus } from "@prisma/client";
import { prisma } from "../../config/db";

import {
    ParticipantListRecord,
    ParticipantDetailRecord,
    ParticipantCertificateEligibleRecord,
    FindAllParticipantsOptions,
    CreateParticipantInput,
} from "./participant.types";


export interface IParticipantRepository {
    findAll(
        organizationId: string,
        contestId: string,
        options: FindAllParticipantsOptions
    ): Promise<{ participants: ParticipantListRecord[]; total: number }>;

    findById(
        contestId: string,
        participantId: string,
        organizationId?: string
    ): Promise<ParticipantDetailRecord | null>;

    disqualify(participantId: string, organizationId: string): Promise<Participant>;

    create(input: CreateParticipantInput): Promise<Participant>;

    updateStatus(participantId: string, status: ParticipantStatus): Promise<Participant>;

    findByContactId(
        organizationId: string,
        contestId: string,
        contactId: string
    ): Promise<boolean>;

    findEligibleForCertificate(
        contestId: string,
        organizationId: string
    ): Promise<ParticipantCertificateEligibleRecord[]>;

    findIdsByContactId(contactId: string, organizationId: string): Promise<string[]>;

    findIdByContactAndContest(contactId: string, contestId: string, organizationId: string): Promise<string | null>;

    findContestIdByParticipantId(participantId: string, organizationId: string): Promise<string | null>;

    findOrganizationIdByParticipantId(participantId: string): Promise<string | null>;

    getStatusSummary(contestId: string, organizationId: string): Promise<Record<ParticipantStatus, number>>;

    updateStatuses(participantIds: string[], status: ParticipantStatus, organizationId: string): Promise<number>;
}



export class ParticipantRepository implements IParticipantRepository {
    async findAll(
        organizationId: string,
        contestId: string,
        { status, search, page, limit }: FindAllParticipantsOptions
    ): Promise<{ participants: ParticipantListRecord[]; total: number }> {
        const where: Prisma.ParticipantWhereInput = {
            organizationId,
            contestId,
            ...(status ? { status } : {}),
            ...(search
                ? {
                    OR: [
                        { registrationRef: { contains: search, mode: "insensitive" } },
                        { contact: { email: { contains: search, mode: "insensitive" } } },
                        { contact: { firstName: { contains: search, mode: "insensitive" } } },
                    ],
                }
                : {}),
        };

        const skip = (page - 1) * limit;

        const [participants, total] = await prisma.$transaction([
            prisma.participant.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "asc" },
                include: {
                    contact: {
                        select: { firstName: true, lastName: true, email: true, phone: true },
                    },
                    payment: { select: { status: true, amount: true } },
                },
            }),
            prisma.participant.count({ where }),
        ]);

        return { participants, total };
    }

    async findById(
        contestId: string,
        participantId: string,
        organizationId?: string
    ): Promise<ParticipantDetailRecord | null> {
        return prisma.participant.findFirst({
            where: {
                OR: [
                    { id: participantId },
                    { registrationRef: participantId },
                ],
                ...(contestId ? { contestId } : {}),
                ...(organizationId ? { organizationId } : {}),
            },
            include: {
                contact: true,
                payment: true,
                submission: true,
                proctoring: true,
                contest: true,
                leaderboard: true,
            },
        });
    }

    async disqualify(participantId: string, organizationId: string): Promise<Participant> {
        return prisma.participant.update({
            where: { id: participantId, organizationId },
            data: { status: ParticipantStatus.DISQUALIFIED },
        });
    }

    async create(input: CreateParticipantInput): Promise<Participant> {
        return await prisma.participant.create({
            data: {
                organizationId: input.organizationId,
                contactId: input.contactId,
                contestId: input.contestId,
                registrationRef: input.registrationRef,
                status: input.status ?? ParticipantStatus.REGISTERED,
            },
        });
    }

    async updateStatus(participantId: string, status: ParticipantStatus): Promise<Participant> {
        return prisma.participant.update({
            where: { id: participantId },
            data: { status },
        });
    }

    async findByContactId(
        organizationId: string,
        contestId: string,
        contactId: string
    ): Promise<boolean> {
        const count = await prisma.participant.count({
            where: { organizationId, contestId, contactId },
        });
        return count > 0;
    }

    async findEligibleForCertificate(
        contestId: string,
        organizationId: string
    ): Promise<ParticipantCertificateEligibleRecord[]> {
        return prisma.participant.findMany({
            where: {
                contestId,
                organizationId,
                status: ParticipantStatus.SUBMITTED,
                submission: { status: "EVALUATED" },
                certificate: null,
            },
            include: { contact: { select: { firstName: true, lastName: true, email: true } } },
        });
    }

    async findIdsByContactId(contactId: string, organizationId: string): Promise<string[]> {
        const participants = await prisma.participant.findMany({
            where: { contactId, organizationId },
            select: { id: true },
        });
        return participants.map((p) => p.id);
    }

    async findIdByContactAndContest(
        contactId: string,
        contestId: string,
        organizationId: string
    ): Promise<string | null> {
        const participant = await prisma.participant.findFirst({
            where: { contactId, contestId, organizationId },
            select: { id: true },
        });
        return participant?.id ?? null;
    }

    async findContestIdByParticipantId(
        participantId: string,
        organizationId: string
    ): Promise<string | null> {
        const participant = await prisma.participant.findFirst({
            where: { id: participantId, organizationId },
            select: { contestId: true },
        });
        return participant?.contestId ?? null;
    }

    async findOrganizationIdByParticipantId(participantId: string): Promise<string | null> {
        const participant = await prisma.participant.findFirst({
            where: { id: participantId },
            select: { organizationId: true },
        });
        return participant?.organizationId ?? null;
    }

    async getStatusSummary(contestId: string, organizationId: string): Promise<Record<ParticipantStatus, number>> {
        const counts = await prisma.participant.groupBy({
            by: ["status"],
            where: { contestId, organizationId },
            _count: { status: true },
        });

        const summary: Record<ParticipantStatus, number> = {
            PENDING_PAYMENT: 0,
            REGISTERED: 0,
            CHECKED_IN: 0,
            IN_WAITING: 0,
            IN_QUIZ: 0,
            SUBMITTED: 0,
            DISQUALIFIED: 0,
            ABSENT: 0,
        };

        for (const item of counts) {
            summary[item.status] = item._count.status;
        }

        return summary;
    }

    async updateStatuses(participantIds: string[], status: ParticipantStatus, organizationId: string): Promise<number> {
        const result = await prisma.participant.updateMany({
            where: {
                id: { in: participantIds },
                organizationId,
            },
            data: { status },
        });
        return result.count;
    }
}
