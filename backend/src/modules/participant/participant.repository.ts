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
    ): Promise<Participant | null>;

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

    /**
     * Participants still pre-quiz (never got a socket-driven quiz:v1:join) at the
     * moment a contest starts — the DB-level fallback for CONTEST_START, used by both
     * the scheduled job and the manual "Start Now" override.
     */
    findAwaitingStart(contestId: string, organizationId: string): Promise<Array<{ id: string; contactId: string }>>;
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
                        select: { firstName: true, lastName: true, email: true, phone: true, college: true, department: true, city: true, state: true },
                    },
                    payment: { select: { id: true, status: true, amount: true, razorpayPaymentId: true, paidAt: true, provider: true } },
                },
                // customFields is a scalar column on Participant, included by default
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
                referredByEnrollmentId: input.referredByEnrollmentId ?? null,
                ...(input.customFields ? { customFields: input.customFields } : {}),
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
    ): Promise<Participant | null> {
        return prisma.participant.findFirst({
            where: { organizationId, contestId, contactId },
        });
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

    /**
     * DB-fallback recovery set for contest start — participants whose Redis
     * waiting-room presence may have been lost (the live source of truth;
     * anyone CURRENTLY there is already caught by transitionToQuiz's own
     * Redis read, not this query) but who genuinely reached the waiting room
     * at some point, per DB status.
     *
     * Deliberately does NOT include REGISTERED or CHECKED_IN — those are
     * pre-socket states (signed up / verified a join code via HTTP) that
     * don't imply the participant ever opened a WebSocket connection at all.
     * Including them force-started every registrant regardless of whether
     * they showed up, which is exactly why a participant who never touched
     * the app could appear in Live Monitor with a placeholder name and 0%
     * progress — and at load-test scale, meant this loop iterated the full
     * registered-participant count (hundreds to low thousands) on every
     * contest start, synchronously, right as real participants were also
     * connecting. IN_WAITING itself is DB-lagging by design (see
     * analytics.worker.ts's flushParticipantStatuses — it's the only place
     * participant.status is written during a live quiz, on a periodic
     * snapshot cycle), so this only ever catches participants who were
     * confirmed in the waiting room as of the last flush before the contest
     * started — never someone who merely registered or checked in.
     */
    async findAwaitingStart(contestId: string, organizationId: string): Promise<Array<{ id: string; contactId: string }>> {
        return prisma.participant.findMany({
            where: {
                contestId,
                organizationId,
                status: "IN_WAITING",
            },
            select: { id: true, contactId: true },
        });
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
