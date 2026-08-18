import { Prisma } from "@prisma/client";
import { ulid } from "ulidx";
import { prisma } from "../../config/db";
import { ProgressSnapshotRow } from "./durability.types";

export class DurabilityRepository {

    /**
     * Bulk upsert one batch of progress snapshots in a single statement.
     * Caller (service layer) is responsible for chunking into
     * config.durability.snapshotBatchSize-sized batches — this method is
     * deliberately dumb: one batch in, one batch written.
     */
    async upsertManyProgressSnapshots(rows: ProgressSnapshotRow[]): Promise<void> {
        if (rows.length === 0) return;

        const valueRows = rows.map((row) => Prisma.sql`(
            ${ulid()},
            ${row.organizationId},
            ${row.contestId},
            ${row.participantId},
            ${row.phase},
            ${JSON.stringify(row.answers)}::jsonb,
            ${row.questionOrder ? JSON.stringify(row.questionOrder) : null}::jsonb,
            ${row.currentQuestion},
            ${row.totalQuestions},
            ${row.violationCount},
            ${row.startedAt},
            ${row.contestEndTime},
            now(),
            now()
        )`);

        await prisma.$executeRaw`
            INSERT INTO "participant_progress_snapshots" (
                "id", "organizationId", "contestId", "participantId", "phase",
                "answers", "questionOrder", "currentQuestion", "totalQuestions",
                "violationCount", "startedAt", "contestEndTime", "lastSnapshotAt", "createdAt"
            )
            VALUES ${Prisma.join(valueRows)}
            ON CONFLICT ("participantId") DO UPDATE SET
                "phase" = EXCLUDED."phase",
                "answers" = EXCLUDED."answers",
                "questionOrder" = EXCLUDED."questionOrder",
                "currentQuestion" = EXCLUDED."currentQuestion",
                "totalQuestions" = EXCLUDED."totalQuestions",
                "violationCount" = EXCLUDED."violationCount",
                "startedAt" = EXCLUDED."startedAt",
                "contestEndTime" = EXCLUDED."contestEndTime",
                "lastSnapshotAt" = now()
        `;
    }

    async findByParticipantId(participantId: string) {
        return prisma.participantProgressSnapshot.findUnique({
            where: { participantId },
        });
    }
}
