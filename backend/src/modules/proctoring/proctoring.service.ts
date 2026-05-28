import { IProctoringRepository } from "./proctoring.repository";
import {
    ProctoringPaginationOptions,
    ProctoringScoreRecord,
    ProctoringEventRecord
} from "./proctoring.types";
import { NotFoundError } from "../../error/http-errors";
import { config } from "../../config";
import { getStorageProvider } from "../../providers/storage.provider";

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
        const provider = getStorageProvider();

        const processedEvents = await Promise.all(
            events.map(async (event) => {
                const s3Key = (event.metadata as any)?.s3Key as string | undefined;
                let snapshotUrl: string | null = null;

                if (s3Key) {
                    try {
                        const { url } = await provider.getPresignedGetUrl({
                            storageKey: s3Key,
                            expiresInSeconds: 3600 * 24, // 24 hours
                        });
                        snapshotUrl = url;
                    } catch (err) {
                        snapshotUrl = null;
                    }
                }

                return {
                    ...event,
                    snapshotUrl,
                };
            })
        );

        return processedEvents;
    }

    /**
     * Returns admin-only snapshot captures for a participant with presigned read URLs.
     * Only SNAPSHOT_* events with a stored s3Key in metadata are returned.
     */
    async getParticipantCaptures(contestId: string, participantId: string) {
        const rawCaptures = await this.proctoringRepo.findCaptures(contestId, participantId);
        const provider = getStorageProvider();

        const captures = await Promise.all(
            rawCaptures.map(async (event: any) => {
                const s3Key = (event.metadata as any)?.s3Key as string | undefined;
                let presignedGetUrl: string | null = null;

                if (s3Key) {
                    try {
                        const { url } = await provider.getPresignedGetUrl({
                            storageKey: s3Key,
                            expiresInSeconds: 3600,
                        });
                        presignedGetUrl = url;
                    } catch {
                        presignedGetUrl = null;
                    }
                }

                return {
                    id: event.id,
                    captureType: event.type,
                    capturedAt: event.occurredAt,
                    presignedGetUrl,
                };
            })
        );

        // Only return captures that actually have a resolvable URL
        return captures.filter((c: any) => c.presignedGetUrl !== null);
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
