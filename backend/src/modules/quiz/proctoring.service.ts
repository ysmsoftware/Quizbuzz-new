/**
 * Proctoring Service
 *
 * Processes client-reported violations and identity audit snapshots.
 * All detection runs client-side (TensorFlow.js) — the server only
 * receives structured metadata, never raw video frames.
 */

import { config } from "../../config";
import logger from "../../config/logger";
import { QuizSession } from "./quiz.session";
import type { PrismaClient } from "@prisma/client";
import type {
    ViolationEvent,
    ViolationSummary,
    CaptureType,
    SnapshotMetadata,
} from "./quiz.types";

const VIOLATION_THRESHOLD = config.proctoring.threshold;

type ViolationSeverity = "LOW" | "MEDIUM" | "HIGH";

const severityMap: Record<ViolationSeverity, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
};

export class ProctoringService {
    constructor(
        private prisma: PrismaClient,
        private sessionRepo: QuizSession,
    ) {}

    /**
     * Records a proctoring violation detected by the client.
     */
    async recordViolation(
        participantId: string,
        contestId: string,
        organizationId: string,
        violation: ViolationEvent,
    ): Promise<{
        totalViolations: number;
        threshold: number;
        flagged: boolean;
    }> {
        // 1. Append to Redis
        const totalViolations = await this.sessionRepo.recordViolation(
            contestId,
            participantId,
            violation,
        );

        // 2. Persist to PostgreSQL (fire-and-forget)
        this.persistViolationToDB(participantId, contestId, organizationId, violation)
            .catch((err) => {
                logger.error(`[proctoring] Failed to persist violation to DB: ${err.message}`);
            });

        // 3. Check threshold
        const flagged = totalViolations >= VIOLATION_THRESHOLD;

        if (flagged) {
            this.flagParticipant(participantId, contestId, organizationId, totalViolations)
                .catch((err) => {
                    logger.error(`[proctoring] Failed to flag participant: ${err.message}`);
                });
        }

        return { totalViolations, threshold: VIOLATION_THRESHOLD, flagged };
    }

    /**
     * Stores identity audit snapshot metadata
     */
    async storeSnapshot(
        participantId: string,
        contestId: string,
        organizationId: string,
        captureType: CaptureType,
        imageBase64: string,
        timestamp: string,
    ): Promise<SnapshotMetadata> {
        const s3Key = `proctoring/${contestId}/${participantId}/${captureType}_${Date.now()}.webp`;

        const event = await this.prisma.proctoringEvent.create({
            data: {
                participantId,
                contestId,
                organizationId,
                type: `SNAPSHOT_${captureType}` as any,
                severity: severityMap["LOW"],
                metadata: { s3Key, captureType, timestamp } as any,
            },
        });

        return {
            id: event.id,
            participantId,
            contestId,
            captureType,
            s3Key,
            capturedAt: event.occurredAt,
        };
    }

    /**
     * Returns a summary of violations for a participant
     */
    async getViolationSummary(contestId: string, participantId: string): Promise<ViolationSummary> {
        const violations = await this.sessionRepo.getViolations(contestId, participantId);
        const total = violations.length;
        const byType: Partial<Record<string, number>> = {};

        for (const v of violations) {
            byType[v.type] = (byType[v.type] ?? 0) + 1;
        }

        return {
            total,
            byType: byType as ViolationSummary["byType"],
            flagged: total >= VIOLATION_THRESHOLD,
            threshold: VIOLATION_THRESHOLD,
        };
    }

    /**
     * Gets total violations across all active participants in a contest
     */
    async getTotalViolationsForContest(contestId: string): Promise<number> {
        const activeIds = await this.sessionRepo.getActiveMembers(contestId);
        let total = 0;
        for (const pid of activeIds) {
            total += await this.sessionRepo.getViolationCount(contestId, pid);
        }
        return total;
    }

    private async persistViolationToDB(
        participantId: string,
        contestId: string,
        organizationId: string,
        violation: ViolationEvent,
    ): Promise<void> {
        if (!config.features.proctoring) return;

        await this.prisma.proctoringEvent.create({
            data: {
                participantId,
                contestId,
                organizationId,
                type: violation.type as any,
                severity: severityMap[violation.severity] || 1,
                metadata: (violation.metadata ?? {}) as any,
            },
        });
    }

    private async flagParticipant(
        participantId: string,
        contestId: string,
        organizationId: string,
        totalViolations: number,
    ): Promise<void> {
        await (this.prisma.proctoringScore as any).upsert({
            where: {
                participantId_contestId: { participantId, contestId },
            },
            update: {
                isFlagged: true,
                totalViolations,
            },
            create: {
                participantId,
                contestId,
                organizationId,
                isFlagged: true,
                totalViolations,
                trustScore: 0,
            },
        });
    }
}
