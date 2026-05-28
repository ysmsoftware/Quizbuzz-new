import { PrismaClient, ViolationType, ProctoringEvent, ProctoringScore, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import {
    ProctoringPaginationOptions,
    ProctoringScoreRecord,
    ProctoringEventRecord
} from "./proctoring.types";

export interface IProctoringRepository {
    findEvents(contestId: string, participantId: string): Promise<ProctoringEventRecord[]>;
    findScores(contestId: string, options: ProctoringPaginationOptions): Promise<{ scores: ProctoringScoreRecord[], total: number }>;
    updateScoreStatus(scoreId: string, organizationId: string, isDismissed: boolean): Promise<ProctoringScore>;
    getContestStats(contestId: string): Promise<{ totalEvents: number, flaggedParticipants: number, eventsByType: any }>;
    findScoreById(scoreId: string, organizationId: string): Promise<ProctoringScore | null>;
    findCaptures(contestId: string, participantId: string): Promise<{ id: string; type: string; occurredAt: Date; metadata: any }[]>;
}

export class ProctoringRepository implements IProctoringRepository {
    async findEvents(contestId: string, participantId: string): Promise<ProctoringEventRecord[]> {
        return prisma.proctoringEvent.findMany({
            where: { contestId, participantId },
            orderBy: { occurredAt: "desc" },
        }) as Promise<ProctoringEventRecord[]>;
    }

    async findScores(
        contestId: string,
        { page, limit, isFlagged }: ProctoringPaginationOptions
    ): Promise<{ scores: ProctoringScoreRecord[], total: number }> {
        const where = {
            contestId,
            ...(isFlagged !== undefined ? { isFlagged } : {}),
        };

        const [scores, total] = await prisma.$transaction([
            prisma.proctoringScore.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    organization: {
                        select: {
                            name: true
                        }
                    },
                    participant: {
                        include: {
                            contact: true
                        }
                    }
                },
                orderBy: { violationScore: "desc" },
            }),
            prisma.proctoringScore.count({ where }),
        ]);

        return { scores: scores as any, total };
    }

    async updateScoreStatus(
        scoreId: string,
        organizationId: string,
        isDismissed: boolean,
    ): Promise<ProctoringScore> {
        // Note: adminNotes parameter is accepted for API consistency but cannot be persisted
        // as the ProctoringScore schema does not have an adminNotes field.
        // If adminNotes need to be stored, the schema should be updated.

        return prisma.proctoringScore.update({
            where: { id: scoreId },
            data: {
                isFlagged: !isDismissed,
                trustScore: isDismissed ? new Prisma.Decimal(100) : new Prisma.Decimal(0),
                flaggedAt: isDismissed ? null : new Date(),
            } as any
        });
    }

    async findScoreById(scoreId: string, organizationId: string): Promise<ProctoringScore | null> {
        return prisma.proctoringScore.findFirst({
            where: { id: scoreId, organizationId }
        });
    }

    async getContestStats(contestId: string): Promise<{ totalEvents: number, flaggedParticipants: number, eventsByType: any }> {
        const [totalEvents, flaggedParticipants, eventGroups] = await prisma.$transaction([
            prisma.proctoringEvent.count({ where: { contestId } }),
            prisma.proctoringScore.count({ where: { contestId, isFlagged: true } }),
            prisma.proctoringEvent.groupBy({
                by: ['type'],
                where: { contestId },
                _count: { type: true },
                orderBy: { _count: { type: 'desc' } }
            })
        ]);

        const eventsByType: Record<string, number> = {};
        (eventGroups as any).forEach((g: any) => {
            if (g._count) {
                eventsByType[g.type] = g._count.type || 0;
            }
        });

        return { totalEvents, flaggedParticipants, eventsByType };
    }

    /**
     * Returns all SNAPSHOT_* proctoring events for a participant that have a storage key.
     * Used by the admin captures endpoint to generate presigned GET URLs.
     */
    async findCaptures(
        contestId: string,
        participantId: string,
    ): Promise<{ id: string; type: string; occurredAt: Date; metadata: any }[]> {
        return prisma.proctoringEvent.findMany({
            where: {
                contestId,
                participantId,
            },
            select: {
                id: true,
                type: true,
                occurredAt: true,
                metadata: true,
            },
            orderBy: { occurredAt: 'asc' },
        }) as any;
    }
}
