

import { ContestStatus } from "@prisma/client";
import { QuestionRepository } from "./question.repository";
import {
    CreateQuestionInput,
    UpdateQuestionInput,
    BulkCreateQuestionsInput,
    ListQuestionsQueryInput,
    AssignQuestionsInput,
    UpdateContestQuestionInput,
    AutoGenerateQuestionsInput,
} from "./question.validator";
import { BulkImportResult, AssignQuestionsResult, ShuffledQuestionSet } from "./question.types";
import { shuffleQuestionsForParticipant, replayShuffleFromSeed, buildSessionSeed, } from "./question.shuffle";
import { BadRequestError, NotFoundError, UnprocessableEntityError } from "../../error/http-errors";
import { config } from "../../config";
import { ContestService } from "../contest/contest.service";
import { prisma } from "../../config/db";

// ─── Contest context the service needs but doesn't own ───────────────────────

export interface ContestContext {
    id: string;
    organizationId: string;
    status: ContestStatus;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
}

/**
 * Minimal interface the service requires from ContestModule.
 * ContestModule implements this and injects it — keeps the two modules
 * loosely coupled with no circular import.
 */
export interface IContestContextProvider {
    getContestContext(contestId: string, organizationId: string): Promise<ContestContext>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class QuestionService {
    constructor(
        private readonly questionRepo: QuestionRepository,
        private readonly contestService: ContestService
    ) { }

    // ─── Question Bank ──────────────────────────────────────────────────────

    async createQuestion(organizationId: string, dto: CreateQuestionInput) {
        this.validateQuestionDto(dto);
        return this.questionRepo.create(organizationId, dto);
    }

    async bulkCreateQuestions(
        organizationId: string,
        dto: BulkCreateQuestionsInput
    ): Promise<BulkImportResult> {
        if (dto.questions.length > config.questions.bulkImportLimit) {
            throw new UnprocessableEntityError(
                `Bulk import limit is ${config.questions.bulkImportLimit} questions per request`
            );
        }

        const results = await this.questionRepo.bulkCreate(organizationId, dto.questions);

        const errors: BulkImportResult["errors"] = [];
        const ids: string[] = [];
        let created = 0;
        let failed = 0;

        results.forEach((result: { success: boolean; id?: string; error?: string }, index: number) => {
            if (result.success && result.id) {
                created++;
                ids.push(result.id);
            } else {
                failed++;
                errors.push({ index, reason: result.error ?? "Unknown error" });
            }
        });

        return { created, failed, errors, ids };
    }

    async getQuestion(questionId: string, organizationId: string) {
        const question = await this.questionRepo.findById(questionId, organizationId);
        if (!question) throw new NotFoundError("Question not found");
        return question;
    }

    async listQuestions(organizationId: string, query: ListQuestionsQueryInput) {
        const { questions, total } = await this.questionRepo.list(organizationId, query);
        const { page, limit } = query;
        return {
            questions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async updateQuestion(
        questionId: string,
        organizationId: string,
        dto: UpdateQuestionInput
    ) {
        // Ownership check
        const question = await this.questionRepo.findById(questionId, organizationId);
        if (!question) throw new NotFoundError("Question not found");

        // Block updates on questions currently in a live quiz
        const assignedContestIds = await this.questionRepo.getAssignedContestIds(questionId, organizationId);
        const isLive = await this.contestService.areAnyLive(assignedContestIds, organizationId);
        if (isLive) {
            throw new UnprocessableEntityError(
                "Cannot edit a question that is assigned to a currently LIVE contest"
            );
        }

        if (dto.options) {
            this.validateQuestionDto({ ...question, ...dto, options: dto.options } as any);
        }

        return this.questionRepo.update(questionId, organizationId, dto);
    }

    async deleteQuestion(questionId: string, organizationId: string) {
        const question = await this.questionRepo.findById(questionId, organizationId);
        if (!question) throw new NotFoundError("Question not found");

        const assignedContestIds = await this.questionRepo.getAssignedContestIds(questionId, organizationId);
        const isLive = await this.contestService.areAnyLive(assignedContestIds, organizationId);
        if (isLive) {
            throw new UnprocessableEntityError(
                "Cannot delete a question that is assigned to a currently LIVE contest"
            );
        }

        return this.questionRepo.softDelete(questionId, organizationId);
    }

    async getDistinctTags(organizationId: string) {
        return this.questionRepo.getDistinctTags(organizationId);
    }

    // ─── Contest–Question Assignment ────────────────────────────────────────

    async assignQuestionsToContest(
        contestId: string,
        organizationId: string,
        dto: AssignQuestionsInput
    ): Promise<AssignQuestionsResult> {
        const contest = await this.contestService.getContestContext(contestId, organizationId);

        if (contest.status !== ContestStatus.DRAFT) {
            throw new UnprocessableEntityError("Questions can only be assigned to DRAFT contests");
        }

        // Validate all questionIds belong to this org
        const questionIds = dto.questions.map((q) => q.questionId);
        const foreignIds = await this.questionRepo.findForeignQuestionIds(organizationId, questionIds);
        if (foreignIds.length > 0) {
            throw new BadRequestError(
                `The following question IDs do not belong to your organisation: ${foreignIds.join(", ")}`
            );
        }

        const result = await this.questionRepo.assignToContest(organizationId, contestId, dto.questions);

        // skipDuplicates means count = only newly inserted rows
        const assigned = result.count;
        const skipped = dto.questions.length - assigned;

        return {
            assigned,
            skipped,
            positions: dto.questions.map((q) => ({
                questionId: q.questionId,
                position: q.position,
            })),
        };
    }

    async removeQuestionFromContest(
        contestId: string,
        questionId: string,
        organizationId: string
    ) {
        const contest = await this.contestService.getContestContext(contestId, organizationId);

        if (contest.status !== ContestStatus.DRAFT) {
            throw new UnprocessableEntityError("Questions can only be removed from DRAFT contests");
        }

        const assignment = await this.questionRepo.getContestQuestion(contestId, questionId, organizationId);
        if (!assignment) throw new NotFoundError("Question is not assigned to this contest");

        return this.questionRepo.removeFromContest(contestId, questionId, organizationId);
    }

    async updateContestQuestion(contestId: string, questionId: string, organizationId: string, dto: UpdateContestQuestionInput) {
        const contest = await this.contestService.getContestContext(contestId, organizationId);

        if (contest.status !== ContestStatus.DRAFT) {
            throw new UnprocessableEntityError("Marks and negative marks can only be changed on DRAFT contests");
        }

        const assignment = await this.questionRepo.getContestQuestion(contestId, questionId, organizationId);
        if (!assignment) throw new NotFoundError("Question is not assigned to this contest");

        return this.questionRepo.updateContestQuestion(contestId, questionId, organizationId, dto);
    }

    // ─── Contest Question Reads ─────────────────────────────────────────────

    async getContestQuestions(contestId: string, organizationId: string) {
        await this.contestService.getContestContext(contestId, organizationId);
        return this.questionRepo.getContestQuestions(contestId, organizationId);
    }

    // ─── Quiz Delivery ───────────────────────────────────────────────────────

    async getShuffledQuestionsForParticipant(
        contestId: string,
        participantId: string,
        organizationId: string,
        shuffleQ: boolean,
        shuffleOpts: boolean
    ): Promise<ShuffledQuestionSet> {
        const questions = await this.questionRepo.getContestQuestions(contestId, organizationId);

        if (questions.length === 0) {
            throw new UnprocessableEntityError("This contest has no questions assigned");
        }

        const sessionSeed = buildSessionSeed(participantId, contestId);

        return shuffleQuestionsForParticipant(questions, sessionSeed, shuffleQ, shuffleOpts);
    }


    async replayShuffleForReconnect(
        contestId: string,
        participantId: string,
        organizationId: string,
        shuffleQ: boolean,
        shuffleOpts: boolean
    ): Promise<ShuffledQuestionSet> {
        const questions = await this.questionRepo.getContestQuestions(contestId, organizationId);
        const sessionSeed = buildSessionSeed(participantId, contestId);
        return replayShuffleFromSeed(questions, sessionSeed, shuffleQ, shuffleOpts);
    }

    async autoGenerateQuestions(
        contestId: string,
        organizationId: string,
        dto: AutoGenerateQuestionsInput
    ) {
        const contest = await this.contestService.getContestContext(contestId, organizationId);
        if (contest.status !== ContestStatus.DRAFT) {
            throw new UnprocessableEntityError("Questions can only be generated for DRAFT contests");
        }

        const totalTarget = dto.totalQuestions;
        const ruleTargetCounts = dto.rules.map((rule) => {
            const fraction = rule.percentage / 100;
            return {
                rule,
                target: Math.floor(fraction * totalTarget),
            };
        });

        let currentSum = ruleTargetCounts.reduce((sum, r) => sum + r.target, 0);
        let remainder = totalTarget - currentSum;
        let ruleIdx = 0;
        while (remainder > 0) {
            ruleTargetCounts[ruleIdx % ruleTargetCounts.length]!.target += 1;
            remainder--;
            ruleIdx++;
        }

        const selectedQuestionIds = new Set<string>();

        for (const ruleCount of ruleTargetCounts) {
            const rule = ruleCount.rule;
            const targetForRule = ruleCount.target;
            if (targetForRule <= 0) continue;

            const difficulties = ["EASY", "MEDIUM", "HARD"] as const;
            const diffTargets = difficulties.map((diff) => {
                const pct = rule.difficultyBreakdown[diff] || 0;
                return {
                    difficulty: diff,
                    target: Math.floor((pct / 100) * targetForRule),
                };
            });

            let diffSum = diffTargets.reduce((sum, d) => sum + d.target, 0);
            let diffRemainder = targetForRule - diffSum;
            let diffIdx = 0;
            while (diffRemainder > 0) {
                diffTargets[diffIdx % diffTargets.length]!.target += 1;
                diffRemainder--;
                diffIdx++;
            }

            const ruleCandidatesByDiff: Record<"EASY" | "MEDIUM" | "HARD", string[]> = {
                EASY: [],
                MEDIUM: [],
                HARD: [],
            };

            for (const diff of difficulties) {
                const candidates = await this.questionRepo.findCandidatesForAutoGenerate(
                    organizationId,
                    contestId,
                    rule.tags,
                    diff
                );
                ruleCandidatesByDiff[diff] = candidates
                    .map((c) => c.id)
                    .filter((id) => !selectedQuestionIds.has(id));
            }

            const shuffleArray = <T>(arr: T[]): T[] => {
                const res = [...arr];
                for (let i = res.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [res[i], res[j]] = [res[j]!, res[i]!];
                }
                return res;
            };

            const ruleSelectedIds: string[] = [];
            const extraCandidates: string[] = [];

            for (const diffTarget of diffTargets) {
                const diff = diffTarget.difficulty;
                const reqCount = diffTarget.target;
                const pool = shuffleArray(ruleCandidatesByDiff[diff]);

                const taken = pool.slice(0, reqCount);
                ruleSelectedIds.push(...taken);

                const leftover = pool.slice(reqCount);
                extraCandidates.push(...leftover);
            }

            let needed = targetForRule - ruleSelectedIds.length;
            if (needed > 0 && extraCandidates.length > 0) {
                const shuffledExtras = shuffleArray(extraCandidates);
                const takenExtras = shuffledExtras.slice(0, needed);
                ruleSelectedIds.push(...takenExtras);
                needed -= takenExtras.length;
            }

            for (const id of ruleSelectedIds) {
                selectedQuestionIds.add(id);
            }
        }

        if (selectedQuestionIds.size === 0) {
            throw new BadRequestError("No questions matching your criteria were found in the question bank.");
        }

        const currentMaxPosition = await this.questionRepo.countContestQuestions(contestId, organizationId);
        let nextPosition = currentMaxPosition + 1;

        const assignments = Array.from(selectedQuestionIds).map((qId, idx) => ({
            questionId: qId,
            position: nextPosition + idx,
            marks: 1,
            negativeMark: 0,
        }));

        const assignResult = await this.questionRepo.assignToContest(
            organizationId,
            contestId,
            assignments
        );

        const assignedQuestions = await prisma.contestQuestion.findMany({
            where: {
                contestId,
                questionId: { in: Array.from(selectedQuestionIds) },
                organizationId,
            },
            include: {
                question: {
                    include: { options: { orderBy: { position: "asc" } } },
                },
            },
            orderBy: { position: "asc" },
        });

        return {
            assignedCount: assignResult.count,
            questions: assignedQuestions.map((aq) => ({
                id: aq.question.id,
                questionText: aq.question.questionText,
                difficulty: aq.question.difficulty,
                tags: aq.question.tags,
                marks: aq.marks,
                negativeMark: Number(aq.negativeMark),
            })),
        };
    }

    private validateQuestionDto(dto: { options: Array<{ isCorrect: boolean }> }) {
        const correctCount = dto.options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
            throw new BadRequestError("Exactly one option must be marked as correct");
        }
        if (dto.options.length < 2) {
            throw new BadRequestError("A question must have at least 2 options");
        }
    }
}