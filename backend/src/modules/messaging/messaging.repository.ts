import { MessageLog } from "@prisma/client";
import { prisma } from "../../config/db";

export class MessagingRepository {

    async findByParticipantIds(participantIds: string[], organizationId: string, skip: number, take: number) {
        if (participantIds.length === 0) return [];
        return prisma.messageLog.findMany({
            where: {
                participantId: { in: participantIds },
                organizationId
            },
            orderBy: { createdAt: "desc" },
            skip,
            take,
            select: {
                id: true,
                channel: true,
                template: true,
                status: true,
                recipient: true,
                sentAt: true,
                createdAt: true,
                contest: {
                    select: { id: true, title: true },
                },
            },
        });
    }

    async countByParticipantIds(participantIds: string[], organizationId: string): Promise<number> {
        if (participantIds.length === 0) return 0;
        return prisma.messageLog.count({
            where: {
                participantId: { in: participantIds },
                organizationId
            },
        });
    }

    async findById(id: string, organizationId?: string) {
        return prisma.messageLog.findFirst({
            where: {
                id,
                ...(organizationId && { organizationId})
            },
            include: {
                contest: { select: { id: true, title: true } },
                participant: {
                    include: {
                        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
                    }
                }
            }
        });
    }

    async findByContestId(contestId: string, organizationId: string, skip: number, take: number) {
        return prisma.messageLog.findMany({
            where: {
                contestId,
                organizationId
            },
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: {
                participant: {
                    include: {
                        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }
                    }
                }
            }
        });
    }

    async countByContestId(contestId: string, organizationId: string): Promise<number> {
        return prisma.messageLog.count({
            where: {
                contestId,
                organizationId
            }
        });
    }

    async findByContactAndContest(contactId: string, contestId: string, organizationId: string, skip: number, take: number) {
        return prisma.messageLog.findMany({
            where: {
                contestId,
                participant: { contactId },
                organizationId
            },
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: {
                contest: { select: { id: true, title: true } }
            }
        });
    }

    async countByContactAndContest(contactId: string, contestId: string, organizationId: string): Promise<number> {
        return prisma.messageLog.count({
            where: {
                contestId,
                participant: { contactId },
                organizationId
            }
        });
    }

    async create(data: any) {
        return prisma.messageLog.create({ data });
    }

    async findFailedMessages(organizationId: string) {
        return prisma.messageLog.findMany({
            where: {
                status: "FAILED",
                organizationId
            }
        });
    }

    /**
     * Updates message status with strict state transition validation.
     * State can only move forward: QUEUED -> PROCESSING -> SENT/FAILED.
     * Once SENT or DELIVERED, it cannot go back to PROCESSING or QUEUED.
     */
    async updateStatus(id: string, toStatus: MessageLog["status"], additionalData: any = {}) {
        const message = await prisma.messageLog.findFirst({
            where: { id },
            select: { status: true }
        });
        
        if (!message) return null;

        const statusOrder: Record<string, number> = {
            'QUEUED': 0,
            'PROCESSING': 1,
            'SENT': 2,
            'DELIVERED': 3,
            'FAILED': 2
        };

        const currentOrder = statusOrder[message.status] ?? -1;
        const targetOrder = statusOrder[toStatus as string] ?? -1;

        // Allow retry (FAILED -> QUEUED) explicitly
        if (toStatus === 'QUEUED') {
            if (message.status !== 'FAILED') {
                throw new Error(`Cannot reset status to QUEUED unless it is FAILED. Current status: ${message.status}`);
            }
        } else if (message.status === 'FAILED' && toStatus === 'PROCESSING') {
            // BullMQ retry: the job processor runs again directly from FAILED
            // without cycling through QUEUED first. This is a valid re-attempt.
            // Fall through to the updateMany below.
        } else if (toStatus === message.status) {
            // Same-state is a no-op — return without writing. 
            // This happens when BullMQ retries a job that stalled in PROCESSING.
            return this.findById(id);
        } else if (targetOrder < currentOrder) {
            throw new Error(`Invalid state transition: ${message.status} to ${toStatus}`);
        }

        // Use updateMany to ensure organization scope in the update as well
        await prisma.messageLog.updateMany({
            where: { id },
            data: {
                status: toStatus as any,
                ...additionalData,
                updatedAt: new Date()
            }
        });

        // Return the updated message (optional, but consistent with original API)
        return this.findById(id);
    }

    async incrementAttempt(id: string): Promise<void> {
        await prisma.messageLog.update({
            where: {id },
            data: { attemptCount: { increment: 1 }}
        })
    }
}
