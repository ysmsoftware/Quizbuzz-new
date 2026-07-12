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
    getContestStats(contestId: string): Promise<{
        totalParticipants: number;
        flaggedCount: number;
        disqualifiedCount: number;
        cleanCount: number;
        averageTrustScore: number;
        totalViolations: number;
        byType: Record<string, number>;
    }>;
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

    async getContestStats(contestId: string): Promise<{
        totalParticipants: number;
        flaggedCount: number;
        disqualifiedCount: number;
        cleanCount: number;
        averageTrustScore: number;
        totalViolations: number;
        byType: Record<string, number>;
    }> {
        const [
            totalEvents,
            totalParticipants,
            flaggedCount,
            disqualifiedCount,
            eventGroups,
            scores
        ] = await prisma.$transaction([
            prisma.proctoringEvent.count({ where: { contestId } }),
            prisma.participant.count({ where: { contestId } }),
            prisma.proctoringScore.count({ where: { contestId, isFlagged: true } }),
            prisma.participant.count({ where: { contestId, status: "DISQUALIFIED" } }),
            prisma.proctoringEvent.groupBy({
                by: ['type'],
                where: { contestId },
                _count: { type: true },
                orderBy: { _count: { type: 'desc' } }
            }),
            prisma.proctoringScore.findMany({
                where: { contestId },
                select: { trustScore: true }
            })
        ]);

        const byType: Record<string, number> = {};
        (eventGroups as any).forEach((g: any) => {
            if (g._count) {
                byType[g.type] = g._count.type || 0;
            }
        });

        const scoreRecordsCount = scores.length;
        const noScoreCount = Math.max(0, totalParticipants - scoreRecordsCount);
        let sumTrustScore = noScoreCount * 100;
        for (const s of scores) {
            sumTrustScore += Number(s.trustScore || 0);
        }
        const averageTrustScore = totalParticipants > 0 
            ? Math.round(sumTrustScore / totalParticipants) 
            : 100;

        const cleanCount = Math.max(0, totalParticipants - flaggedCount - disqualifiedCount);

        return {
            totalParticipants,
            flaggedCount,
            disqualifiedCount,
            cleanCount,
            averageTrustScore,
            totalViolations: totalEvents,
            byType
        };
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
