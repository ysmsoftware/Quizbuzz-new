import { Prisma, SubmissionStatus } from "@prisma/client";
import { prisma } from "../../config/db";
import {
    ApplyEvaluationInput,
    CreateSubmissionInput,
    ListSubmissionsFilter,
    SubmissionDetail,
    SubmissionStatusCounts,
    SubmissionSummary,
} from "./submission.types";

// ─── Prisma include shapes (reused across methods) ────────────────────────────

/**
 * Minimal include for list queries — no answer rows, just the join data
 * needed to build SubmissionSummary.
 */
const SUMMARY_INCLUDE = {
    participant: {
        select: {
            registrationRef: true,
            contact: {
                select: { firstName: true, lastName: true, email: true },
            },
        },
    },
}

/**
 * Full include for single-fetch — answers with question text and options.
 */
const DETAIL_INCLUDE = {
    participant: {
        select: {
            registrationRef: true,
            contact: {
                select: { firstName: true, lastName: true, email: true },
            },
        },
    },
    answers: {
        include: {
            question: {
                select: {
                    questionText: true,
                    difficulty: true,
                    explanation: true,
                    options: {
                        select: { id: true, text: true, isCorrect: true },
                    },
                },
            },
        },
    },
}
// ─── Repository ───────────────────────────────────────────────────────────────

export class SubmissionRepository {

    // ── Writes ────────────────────────────────────────────────────────────────

    /**
     * Atomically creates a Submission row and all Answer rows in one transaction.
     * Called exclusively by the submission worker — never by HTTP handlers.
     */
    async createWithAnswers(input: CreateSubmissionInput) {
        return await prisma.$transaction(async (tx) => {
            const submission = await tx.submission.create({
                data: {
                    organizationId: input.organizationId,
                    participantId: input.participantId,
                    contestId: input.contestId,
                    status: "SUBMITTED",
                    submittedAt: input.submittedAt,
                    timeTakenSecs: input.timeTakenSecs,
                    timeTakenMs: input.timeTakenMs ?? null,
                    totalQuestions: input.totalQuestions,
                    attempted: input.attempted,
                    source: input.source,
                    // score / correct / wrong / skipped filled by evaluation worker
                },
            });

            if (input.answers.length > 0) {
                await tx.answer.createMany({
                    data: input.answers.map((a) => ({
                        organizationId: input.organizationId,
                        submissionId: submission.id,
                        questionId: a.questionId,
                        selectedOptionId: a.selectedOptionId ?? null,
                        // isCorrect / marksAwarded filled by evaluation worker
                    })),
                    skipDuplicates: true, // idempotency guard on retry
                });
            }

            // Eagerly update participant status to SUBMITTED in the DB
            await tx.participant.update({
                where: { id: input.participantId },
                data: { status: "SUBMITTED" },
            });

            return submission;
        });
    }

    /**
     * Writes the scoring results back to Submission + Answer rows.
     * Called by the evaluation worker after scoring is complete.
     * Runs in a transaction so submission + answers are always consistent.
     */
    async applyEvaluationResult(organizationId: string, submissionId: string, input: ApplyEvaluationInput) {
        return prisma.$transaction(async (tx) => {
            // 1. Update the submission-level scores
            await tx.submission.updateMany({
                where: { id: submissionId, organizationId },
                data: {
                    status: "EVALUATED",
                    correct: input.correct,
                    wrong: input.wrong,
                    skipped: input.skipped,
                    attempted: input.attempted,
                    score: input.score,
                    percentage: input.percentage,
                    isPassed: input.isPassed,
                    evaluatedAt: input.evaluatedAt,
                },
            });

            // 2. Update each answer's correctness and marks using bulk raw SQL
            if (input.scoredAnswers.length > 0) {
                const questionIds = input.scoredAnswers.map(a => a.questionId);
                const isCorrectCases = input.scoredAnswers.map(a => Prisma.sql`WHEN "questionId" = ${a.questionId} THEN ${a.isCorrect}`);
                const marksAwardedCases = input.scoredAnswers.map(a => Prisma.sql`WHEN "questionId" = ${a.questionId} THEN ${a.marksAwarded}`);
                
                await tx.$executeRaw`
                    UPDATE "answers"
                    SET 
                        "isCorrect" = CASE 
                            ${Prisma.join(isCorrectCases, ' ')}
                            ELSE "isCorrect"
                        END,
                        "marksAwarded" = CASE 
                            ${Prisma.join(marksAwardedCases, ' ')}
                            ELSE "marksAwarded"
                        END
                    WHERE "submissionId" = ${submissionId}
                      AND "organizationId" = ${organizationId}
                      AND "questionId" IN (${Prisma.join(questionIds)})
                `;
            }
        });
    }

    /**
     * Marks a submission as INVALIDATED (post-disqualification).
     * Only moves forward — never reverts an EVALUATED submission to SUBMITTED.
     */
    async markInvalidated(organizationId: string, submissionId: string) {
        return prisma.submission.updateMany({
            where: { id: submissionId, organizationId },
            data: { status: "INVALIDATED" },
        });
    }

    // ── Reads ─────────────────────────────────────────────────────────────────

    /**
     * Single submission by its own ID — full detail with answers.
     * Used by: admin review, participant result page.
     */
    async findById(organizationId: string, submissionId: string): Promise<SubmissionDetail | null> {
        const row = await prisma.submission.findFirst({
            where: { id: submissionId, organizationId },
            include: DETAIL_INCLUDE,
        });
        if (!row) return null;
        return this._toDetail(row);
    }

    /**
     * Single submission by participantId — full detail with answers.
     * One-to-one: each participant has at most one submission.
     */
    async findByParticipantId(organizationId: string, participantId: string): Promise<SubmissionDetail | null> {
        const row = await prisma.submission.findFirst({
            where: { participantId, organizationId },
            include: DETAIL_INCLUDE,
        });
        if (!row) return null;
        return this._toDetail(row);
    }

    /**
     * Paginated list of all submissions for a contest.
     * Supports status filter and search (registrationRef or email).
     * Returns lean summaries — no answer rows.
     */
    async findByContestId(
        organizationId: string,
        contestId: string,
        filter: ListSubmissionsFilter
    ): Promise<{ rows: SubmissionSummary[]; total: number }> {
        const { page, limit, status, search } = filter;
        const skip = (page - 1) * limit;

        const where: Prisma.SubmissionWhereInput = {
            organizationId,
            contestId,
            ...(status ? { status } : {}),
            ...(search
                ? {
                    OR: [
                        {
                            participant: {
                                registrationRef: { contains: search, mode: "insensitive" },
                            },
                        },
                        {
                            participant: {
                                contact: { email: { contains: search, mode: "insensitive" } },
                            },
                        },
                    ],
                }
                : {}),
        };

        const [rows, total] = await prisma.$transaction([
            prisma.submission.findMany({
                where,
                skip,
                take: limit,
                orderBy: { submittedAt: "desc" },
                include: SUMMARY_INCLUDE,
            }),
            prisma.submission.count({ where }),
        ]);

        return { rows: rows.map(this._toSummary), total };
    }

    /**
     * All submissions across ALL contests for a single contact.
     * Used by admin contact profile view.
     * Joins through participant → contact to scope by contactId.
     * Note: joins only participant table (same domain boundary as participantRepo).
     */
    async findByContactId(
        organizationId: string,
        contactId: string,
        filter: ListSubmissionsFilter
    ): Promise<{ rows: SubmissionSummary[]; total: number }> {
        const { page, limit, status } = filter;
        const skip = (page - 1) * limit;

        const [rows, total] = await prisma.$transaction([
            prisma.submission.findMany({
                where: {
                    organizationId,
                    participant: { contactId },
                    ...(status ? { status } : {}),
                },
                skip,
                take: limit,
                orderBy: { submittedAt: "desc" },
                include: SUMMARY_INCLUDE,
            }),
            prisma.submission.count({
                where: {
                    organizationId,
                    participant: { contactId },
                    ...(status ? { status } : {}),
                },
            }),
        ]);

        return { rows: rows.map(this._toSummary), total };
    }

    /**
     * Status breakdown counts — one DB query, used by admin dashboard.
     */
    async countByStatus(organizationId: string, contestId: string): Promise<SubmissionStatusCounts> {
        const rows = await prisma.submission.groupBy({
            by: ["status"],
            where: { contestId, organizationId },
            _count: { status: true },
        });

        const map: Record<string, number> = {};
        for (const r of rows) {
            // Prisma groupBy types can be complex; using safe access for _count
            const count = (r as any)._count?.status ?? 0;
            map[r.status] = count;
        }

        const pending = map["PENDING"] ?? 0;
        const submitted = map["SUBMITTED"] ?? 0;
        const evaluated = map["EVALUATED"] ?? 0;
        const invalidated = map["INVALIDATED"] ?? 0;

        return {
            pending,
            submitted,
            evaluated,
            invalidated,
            total: pending + submitted + evaluated + invalidated,
        };
    }

    async countByContest(organizationId: string, contestId: string, statuses: SubmissionStatus[]): Promise<number> {
        return prisma.submission.count({
            where: { contestId, organizationId, status: { in: statuses } },
        });
    }

    /**
     * Checks whether a submission already exists for a participant.
     * Used by the submission worker as an idempotency guard before insert.
     */
    async existsForParticipant(organizationId: string, participantId: string): Promise<boolean> {
        const count = await prisma.submission.count({
            where: {
                organizationId,
                participantId,
                status: { not: "PENDING" }, // PENDING = not yet persisted by worker
            },
        });
        return count > 0;
    }

    /**
     * Fetches all SUBMITTED (not yet evaluated) submissions for a contest.
     * Used by the evaluation worker when the admin triggers bulk evaluation.
     */
    async findPendingEvaluation(
        organizationId: string,
        contestId: string
    ): Promise<Array<{ id: string; participantId: string }>> {
        return prisma.submission.findMany({
            where: { contestId, organizationId, status: "SUBMITTED" },
            select: { id: true, participantId: true },
            orderBy: { submittedAt: "asc" }, // FIFO — first submitted, first evaluated
        });
    }

    // ── Private mappers ───────────────────────────────────────────────────────

    private _toSummary(row: any): SubmissionSummary {
        const contact = row.participant?.contact;
        return {
            id: row.id,
            participantId: row.participantId,
            registrationRef: row.participant?.registrationRef ?? "",
            contactName: contact
                ? `${contact.firstName} ${contact.lastName ?? ""}`.trim()
                : "Unknown",
            contactEmail: contact?.email ?? "",
            status: row.status as SubmissionSummary["status"],
            source: (row.source ?? "MANUAL") as SubmissionSummary["source"],
            score: row.score !== null ? Number(row.score) : null,
            percentage: row.percentage !== null ? Number(row.percentage) : null,
            isPassed: row.isPassed ?? null,
            timeTakenSecs: row.timeTakenSecs ?? null,
            timeTakenMs: row.timeTakenMs ?? null,
            submittedAt: row.submittedAt ?? null,
            evaluatedAt: row.evaluatedAt ?? null,
        };
    }

    private _toDetail(row: any): SubmissionDetail {
        const summary = this._toSummary(row);
        const answers: SubmissionDetail["answers"] = (row.answers ?? []).map(
            (a: any) => {
                const correctOption = (a.question?.options ?? []).find(
                    (o: any) => o.isCorrect
                );
                const selectedOption = (a.question?.options ?? []).find(
                    (o: any) => o.id === a.selectedOptionId
                );
                return {
                    questionId: a.questionId,
                    questionText: a.question?.questionText ?? "",
                    difficulty: a.question?.difficulty ?? "Standard",
                    explanation: a.question?.explanation ?? null,
                    selectedOptionId: a.selectedOptionId ?? null,
                    selectedOptionText: selectedOption?.text ?? null,
                    correctOptionId: correctOption?.id ?? "",
                    correctOptionText: correctOption?.text ?? "",
                    isCorrect: a.isCorrect ?? null,
                    marksAwarded:
                        a.marksAwarded !== null ? Number(a.marksAwarded) : null,
                };
            }
        );

        return {
            ...summary,
            correct: row.correct ?? null,
            wrong: row.wrong ?? null,
            skipped: row.skipped ?? null,
            attempted: row.attempted ?? null,
            totalQuestions: row.totalQuestions ?? null,
            answers,
        };
    }
}
