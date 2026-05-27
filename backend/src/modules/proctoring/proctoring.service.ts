import { IProctoringRepository } from "./proctoring.repository";
import {
    ProctoringPaginationOptions,
    ProctoringScoreRecord,
    ProctoringEventRecord
} from "./proctoring.types";
import { NotFoundError } from "../../error/http-errors";
import { config } from "../../config";

export class ProctoringService {
    constructor(private proctoringRepo: IProctoringRepository) { }

    async getContestOverview(contestId: string) {
        return this.proctoringRepo.getContestStats(contestId);
    }

    async getFlaggedParticipants(contestId: string, options: ProctoringPaginationOptions) {
        return this.proctoringRepo.findScores(contestId, options);
    }

    async getParticipantEvents(contestId: string, participantId: string) {
        const events = await this.proctoringRepo.findEvents(contestId, participantId);

        // Construct full public URL for snapshot events so the admin dashboard
        // can render the captured image directly without knowing S3 internals.
        const s3Base = config.storage.provider === "s3"
            ? `https://${config.storage.s3.bucket}.s3.${config.storage.s3.region ?? "ap-south-1"}.amazonaws.com`
            : `${config.app.baseUrl}/api/storage`;

        return events.map((event) => {
            const s3Key = event.metadata?.s3Key as string | undefined;
            const isSnapshot = event.type.startsWith("SNAPSHOT_");

            return {
                ...event,
                snapshotUrl: isSnapshot && s3Key ? `${s3Base}/${s3Key}` : null,
            };
        });
    }

    async updateViolationStatus(
        scoreId: string,
        organizationId: string,
        isDismissed: boolean,
    ) {
        const score = await this.proctoringRepo.findScoreById(scoreId, organizationId);
        if (!score) {
            throw new NotFoundError("Proctoring score record not found");
        }

        return this.proctoringRepo.updateScoreStatus(scoreId, organizationId, isDismissed);
    }
}
