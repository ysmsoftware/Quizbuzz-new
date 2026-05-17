import { IProctoringRepository } from "./proctoring.repository";
import {
    ProctoringPaginationOptions,
    ProctoringScoreRecord,
    ProctoringEventRecord
} from "./proctoring.types";
import { NotFoundError } from "../../error/http-errors";

export class ProctoringService {
    constructor(private proctoringRepo: IProctoringRepository) { }

    async getContestOverview(contestId: string) {
        return this.proctoringRepo.getContestStats(contestId);
    }

    async getFlaggedParticipants(contestId: string, options: ProctoringPaginationOptions) {
        return this.proctoringRepo.findScores(contestId, options);
    }

    async getParticipantEvents(contestId: string, participantId: string) {
        return this.proctoringRepo.findEvents(contestId, participantId);
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
