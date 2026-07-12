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

        // 2. Persist to PostgreSQL (wait for write to query HIGH severity counts immediately after)
        try {
            await this.persistViolationToDB(participantId, contestId, organizationId, violation);
        } catch (err: any) {
            logger.error(`[proctoring] Failed to persist violation to DB: ${err.message}`);
        }

        // 3. Check threshold
        const flagged = totalViolations >= VIOLATION_THRESHOLD;

        // 4. Update proctoring score on every violation
        this.updateProctoringScore(participantId, contestId, organizationId, totalViolations, flagged)
            .catch((err) => {
                logger.error(`[proctoring] Failed to update proctoring score: ${err.message}`);
            });

        return { totalViolations, threshold: VIOLATION_THRESHOLD, flagged };
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

    private async updateProctoringScore(
        participantId: string,
        contestId: string,
        organizationId: string,
        totalViolations: number,
        isFlagged: boolean,
    ): Promise<void> {
        const highSeverityCount = await this.prisma.proctoringEvent.count({
            where: {
                participantId,
                contestId,
                severity: 3, // HIGH Maps to 3
            },
        });

        const trustScore = Math.max(0, 100 - totalViolations * 10 - highSeverityCount * 20);

        await this.prisma.proctoringScore.upsert({
            where: {
                participantId_contestId: { participantId, contestId },
            },
            update: {
                totalViolations,
                highSeverityCount,
                trustScore,
                isFlagged,
                flaggedAt: isFlagged ? new Date() : null,
            },
            create: {
                participantId,
                contestId,
                organizationId,
                totalViolations,
                highSeverityCount,
                trustScore,
                isFlagged,
                flaggedAt: isFlagged ? new Date() : null,
            },
        });
    }
}
