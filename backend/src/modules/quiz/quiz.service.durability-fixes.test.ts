import { QuizService } from "./quiz.service";

jest.mock("../../config/redis", () => ({ redis: {}, pubClient: {}, subClient: {} }));
jest.mock("../../config/db", () => ({
    prisma: { submission: { findUnique: jest.fn() } },
}));
jest.mock("../../queues", () => ({
    submissionQueue: { add: jest.fn() },
}));

import { prisma } from "../../config/db";
import { submissionQueue } from "../../queues";

const mockedFindUnique = (prisma as any).submission.findUnique as jest.Mock;
const mockedQueueAdd = (submissionQueue as any).add as jest.Mock;

describe("QuizService — durability fixes (recovery + concurrent-submit race)", () => {
    let quizService: QuizService;
    let mockSession: any;
    let mockDurability: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockSession = {
            getAllAnswers: jest.fn().mockResolvedValue({}),
            getSession: jest.fn().mockResolvedValue(null),
            getQuestionOrder: jest.fn().mockResolvedValue(null),
            addToSubmitted: jest.fn().mockResolvedValue(undefined),
            acquireSubmissionLock: jest.fn().mockResolvedValue(true),
            releaseSubmissionLock: jest.fn().mockResolvedValue(undefined),
            isSubmissionLocked: jest.fn().mockResolvedValue(false),
        };
        mockDurability = {
            rehydrateParticipant: jest.fn().mockResolvedValue(null),
        };

        quizService = new QuizService(
            mockSession,
            {} as any, // proctoring — unused by the paths under test
            {} as any, // submissionService — unused by the paths under test
            {} as any, // scheduler — unused by the paths under test
            mockDurability,
        );
    });

    // ── Bug fix #1: waitForInFlightSubmission must not give up after one miss ──

    describe("waitForInFlightSubmission — concurrent-submit race", () => {
        it("keeps polling across all attempts and returns the real submission once the DB write lands, instead of bailing on the first miss", async () => {
            mockedFindUnique
                .mockResolvedValueOnce(null)  // attempt 1 — worker hasn't persisted yet
                .mockResolvedValueOnce(null)  // attempt 2 — still hasn't
                .mockResolvedValueOnce({      // attempt 3 — now it's there
                    id: "sub_1",
                    timeTakenSecs: 42,
                    totalQuestions: 10,
                    attempted: 7,
                });

            const result = await (quizService as any).waitForInFlightSubmission("contest_1", "participant_1");

            expect(mockedFindUnique).toHaveBeenCalledTimes(3);
            expect(result).toEqual({
                submissionRef: "sub_1",
                timeTakenSecs: 42,
                totalQuestions: 10,
                attempted: 7,
            });
        }, 10000);

        it("only falls back to the best-effort zero-answer result after every attempt is exhausted", async () => {
            mockedFindUnique.mockResolvedValue(null); // never lands within the window

            const result = await (quizService as any).waitForInFlightSubmission("contest_1", "participant_1");

            expect(mockedFindUnique).toHaveBeenCalledTimes(4);
            expect(result).toEqual({
                submissionRef: "participant_1-contest_1",
                timeTakenSecs: 0,
                totalQuestions: 0,
                attempted: 0,
            });
        }, 10000);
    });

    // ── Recovery path: rehydrate from snapshot instead of zero-answer fallback ──

    describe("doSubmitQuiz — recovery from progress snapshot", () => {
        it("enqueues the recovered answers with source RECOVERED when the Redis session is gone but a snapshot exists", async () => {
            mockDurability.rehydrateParticipant.mockResolvedValue({
                organizationId: "org_1",
                answersArray: [{ questionId: "q1", selectedOptionId: "optA" }],
                totalQuestions: 1,
                attempted: 1,
                startedAt: "2026-08-18T10:00:00.000Z",
                contestEndTime: null,
            });

            const result = await (quizService as any).doSubmitQuiz("contest_1", "participant_1", "AUTO");

            expect(mockedQueueAdd).toHaveBeenCalledTimes(1);
            const [, payload] = mockedQueueAdd.mock.calls[0];
            expect(payload.source).toBe("RECOVERED");
            expect(payload.answers).toEqual([{ questionId: "q1", selectedOptionId: "optA" }]);
            expect(payload.attempted).toBe(1);
            expect(result.attempted).toBe(1);
        });

        it("falls back to the existing zero-answer path when no snapshot exists either", async () => {
            mockDurability.rehydrateParticipant.mockResolvedValue(null);

            await (quizService as any).doSubmitQuiz("contest_1", "participant_1", "TIMEOUT");

            const [, payload] = mockedQueueAdd.mock.calls[0];
            expect(payload.source).toBe("AUTO"); // TIMEOUT collapses to AUTO, same as the pre-existing live path
            expect(payload.answers).toEqual([]);
            expect(payload.attempted).toBe(0);
        });
    });

    // ── Bug fix #2: recovered timeTakenSecs must anchor to contestEndTime, not "now" ──

    describe("doSubmitQuiz — recovered timeTakenSecs anchoring", () => {
        const startedAt = "2026-08-18T10:00:00.000Z";
        const contestEndTime = "2026-08-18T11:00:00.000Z"; // 1-hour contest

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("anchors to contestEndTime when recovery runs long after the contest actually ended", async () => {
            // Recovery fires 4 hours after contestEndTime — simulates a delayed
            // reconciliation sweep picking this participant up long after the
            // outage, not right when they stopped interacting.
            jest.spyOn(Date, "now").mockReturnValue(new Date("2026-08-18T15:00:00.000Z").getTime());

            mockDurability.rehydrateParticipant.mockResolvedValue({
                organizationId: "org_1",
                answersArray: [{ questionId: "q1", selectedOptionId: "optA" }],
                totalQuestions: 1,
                attempted: 1,
                startedAt,
                contestEndTime,
            });

            await (quizService as any).doSubmitQuiz("contest_1", "participant_1", "AUTO");

            const [, payload] = mockedQueueAdd.mock.calls[0];
            // Must equal contestEndTime - startedAt (3600s), NOT now - startedAt (18000s).
            expect(payload.timeTakenSecs).toBe(3600);
        });

        it("falls back to Date.now() when contestEndTime is unknown", async () => {
            jest.spyOn(Date, "now").mockReturnValue(new Date("2026-08-18T10:30:00.000Z").getTime());

            mockDurability.rehydrateParticipant.mockResolvedValue({
                organizationId: "org_1",
                answersArray: [{ questionId: "q1", selectedOptionId: "optA" }],
                totalQuestions: 1,
                attempted: 1,
                startedAt,
                contestEndTime: null,
            });

            await (quizService as any).doSubmitQuiz("contest_1", "participant_1", "AUTO");

            const [, payload] = mockedQueueAdd.mock.calls[0];
            expect(payload.timeTakenSecs).toBe(1800); // 30 minutes, now - startedAt
        });
    });
});
