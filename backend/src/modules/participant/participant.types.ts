import { Prisma, ParticipantStatus } from "@prisma/client";

export type ParticipantListRecord = Prisma.ParticipantGetPayload<{
    include: {
        contact: {
            select: { firstName: true; lastName: true; email: true; phone: true };
        };
        payment: { select: { status: true; amount: true } };
    };
}>;

export type ParticipantDetailRecord = Prisma.ParticipantGetPayload<{
    include: {
        contact: true;
        payment: true;
        submission: true;
        proctoring: true;
        contest: true;
        leaderboard: true;
    };
}>;

export type ParticipantCertificateEligibleRecord = Prisma.ParticipantGetPayload<{
    include: { contact: { select: { firstName: true; lastName: true; email: true } } };
}>;

export interface FindAllParticipantsOptions {
    status?: ParticipantStatus | null | undefined;
    search?: string | null | undefined;
    page: number;
    limit: number;
}

export interface CreateParticipantInput {
    organizationId: string;
    contestId: string;
    contactId: string;
    registrationRef: string;
}
