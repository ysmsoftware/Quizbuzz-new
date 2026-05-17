import { PrismaClient, QuestionDifficulty, Prisma } from "@prisma/client";
import {
    CreateQuestionInput,
    UpdateQuestionInput,
    ListQuestionsQueryInput,
    AssignQuestionsInput,
    UpdateContestQuestionInput,
} from "./question.validator";
import { prisma } from "../../config/db";
import { stripUndefined } from "../../common/utils/prisma.utils";
import { ulid } from "ulidx";


export class QuestionRepository {

    async create(organizationId: string, data: CreateQuestionInput) {
        return prisma.question.create({
            data: {
                organizationId,
                questionText: data.questionText,
                difficulty: data.difficulty,
                hint: data.hint ?? null,
                explanation: data.explanation ?? null,
                tags: data.tags,
                options: {
                    create: data.options.map((opt) => ({
                        organizationId,
                        text: opt.text,
                        isCorrect: opt.isCorrect,
                        position: opt.position,
                    })),
                },
            },
            include: { options: { orderBy: { position: "asc" } } },
        });
    }


    async bulkCreate(
        organizationId: string,
        questions: CreateQuestionInput[]
    ): Promise<Array<{ success: boolean; id?: string; error?: string }>> {
        if (questions.length === 0) return [];
        
        const questionIds = questions.map(() => ulid());
        
        try {
            await prisma.$transaction(async (tx) => {
                const questionsToInsert: any[] = [];
                const optionsToInsert: any[] = [];
                
                questions.forEach((q, index) => {
                    const questionId = questionIds[index];
                    questionsToInsert.push({
                        id: questionId,
                        organizationId,
                        questionText: q.questionText,
                        difficulty: q.difficulty,
                        hint: q.hint ?? null,
                        explanation: q.explanation ?? null,
                        tags: q.tags,
                    });
                    
                    q.options.forEach((opt) => {
                        optionsToInsert.push({
                            id: ulid(),
                            organizationId,
                            questionId,
                            text: opt.text,
                            isCorrect: opt.isCorrect,
                            position: opt.position,
                        });
                    });
                });
                
                await tx.question.createMany({ data: questionsToInsert });
                if (optionsToInsert.length > 0) {
                    await tx.questionOption.createMany({ data: optionsToInsert });
                }
            });
            
            return questionIds.map((id) => ({ success: true, id }));
        } catch (error: any) {
            return questions.map(() => ({ success: false, error: error.message }));
        }
    }

    async findById(questionId: string, organizationId: string) {
        return prisma.question.findFirst({
            where: { id: questionId, organizationId, isDeleted: false },
            include: {
                options: { orderBy: { position: "asc" } },
                contestQuestions: {
                    include: {
                        contest: {
                            select: {
                                id: true,
                                title: true,
                                status: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async list(organizationId: string, query: ListQuestionsQueryInput) {
        const { difficulty, tags, search, contestId, unassignedFor, page, limit } = query;
        const skip = (page - 1) * limit;

        const tagList = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined;


        const where: Prisma.QuestionWhereInput = {
            organizationId,
            isDeleted: false,
            ...(difficulty ? { difficulty } : {}),
            ...(tagList && tagList.length > 0
                ? { tags: { hasSome: tagList } }
                : {}),
            ...(search
                ? { questionText: { contains: search, mode: "insensitive" } }
                : {}),
            ...(contestId
                ? { contestQuestions: { some: { contestId } } }
                : {}),
            ...(unassignedFor
                ? { contestQuestions: { none: { contestId: unassignedFor } } }
                : {}),
        };

        const [questions, total] = await prisma.$transaction([
            prisma.question.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    options: { orderBy: { position: "asc" } },
                    _count: { select: { contestQuestions: true } },
                },
            }),
            prisma.question.count({ where }),
        ]);

        return { questions, total };
    }


    async update(
        questionId: string,
        organizationId: string,
        data: UpdateQuestionInput
    ) {
        const { options, ...questionFields } = data;

        return prisma.$transaction(async (tx) => {
            // 1. Update question fields
            const updated = await tx.question.update({
                where: { id: questionId, organizationId },
                data: {
                    ...(stripUndefined(questionFields) as any),
                    updatedAt: new Date(),
                },
            });

            // 2. Replace options only when caller sends them
            if (options && options.length > 0) {
                // Delete all current options
                await tx.questionOption.deleteMany({ where: { questionId, organizationId } });

                // Re-create with new set (cascade delete handles old ones cleanly)
                await tx.questionOption.createMany({
                    data: options.map((opt) => ({
                        organizationId,
                        questionId,
                        text: opt.text,
                        isCorrect: opt.isCorrect,
                        position: opt.position,
                    })),
                });
            }

            // 3. Return fresh state
            return tx.question.findUniqueOrThrow({
                where: { id: questionId, organizationId },
                include: { options: { orderBy: { position: "asc" } } },
            });
        });
    }

    async softDelete(questionId: string, organizationId: string) {
        return prisma.question.update({
            where: { id: questionId, organizationId },
            data: { isDeleted: true, updatedAt: new Date() },
        });
    }


    async assignToContest(
        organizationId: string,
        contestId: string,
        questions: AssignQuestionsInput["questions"]
    ) {
        return prisma.contestQuestion.createMany({
            data: questions.map((q) => ({
                organizationId,
                contestId,
                questionId: q.questionId,
                position: q.position,
                marks: q.marks,
                negativeMark: q.negativeMark,
            })),
            skipDuplicates: true,
        });
    }

    async removeFromContest(contestId: string, questionId: string, organizationId: string) {
        return prisma.contestQuestion.deleteMany({
            where: { contestId, questionId, organizationId },
        });
    }


    async reorderContestQuestions(contestId: string, organizationId: string, orderedQuestionIds: string[]) {
        if (orderedQuestionIds.length === 0) return;
        
        const cases = orderedQuestionIds.map((id, index) => 
            Prisma.sql`WHEN "questionId" = ${id} THEN ${index + 1}`
        );
        
        return prisma.$executeRaw`
            UPDATE "contest_questions"
            SET "position" = CASE
                ${Prisma.join(cases, ' ')}
            END
            WHERE "contestId" = ${contestId}
              AND "organizationId" = ${organizationId}
              AND "questionId" IN (${Prisma.join(orderedQuestionIds)})
        `;
    }

    async updateContestQuestion(
        contestId: string,
        questionId: string,
        organizationId: string,
        data: UpdateContestQuestionInput
    ) {
        return prisma.contestQuestion.updateMany({
            where: { contestId, questionId, organizationId },
            data: stripUndefined(data) as any,
        });
    }


    async getContestQuestions(contestId: string, organizationId: string) {
        return prisma.contestQuestion.findMany({
            where: { contestId, organizationId },
            orderBy: { position: "asc" },
            include: {
                question: {
                    include: { options: { orderBy: { position: "asc" } } },
                },
            },
        });
    }

    async getContestQuestion(contestId: string, questionId: string, organizationId: string) {
        return prisma.contestQuestion.findFirst({
            where: { contestId, questionId, organizationId },
            include: {
                question: {
                    include: { options: { orderBy: { position: "asc" } } },
                },
            },
        });
    }

    async countContestQuestions(contestId: string, organizationId: string): Promise<number> {
        return prisma.contestQuestion.count({ where: { contestId, organizationId } });
    }


    async getAssignedContestIds(questionId: string, organizationId: string): Promise<string[]> {
        const rows = await prisma.contestQuestion.findMany({
            where: { questionId, organizationId },
            select: { contestId: true },
        });
        return rows.map((r) => r.contestId);
    }


    async findForeignQuestionIds(
        organizationId: string,
        questionIds: string[]
    ): Promise<string[]> {
        const found = await prisma.question.findMany({
            where: {
                id: { in: questionIds },
                organizationId,
                isDeleted: false,
            },
            select: { id: true },
        });

        const foundSet = new Set(found.map((q) => q.id));
        return questionIds.filter((id) => !foundSet.has(id));
    }


    async getContestQuestionIds(contestId: string): Promise<string[]> {
        const rows = await prisma.contestQuestion.findMany({
            where: { contestId },
            orderBy: { position: "asc" },
            select: { questionId: true },
        });
        return rows.map((r) => r.questionId);
    }

    /**
     * Loads every question assigned to a contest with its correct option ID
     * and marks configuration. Used exclusively by the evaluation worker —
     * never exposed to participants (contains isCorrect).
     */
    async getContestQuestionsWithScoringData(
        contestId: string,
        organizationId: string
    ): Promise<Array<{
        questionId: string;
        marks: number;
        negativeMark: string;
        correctOptionId: string;
    }>> {
        const rows = await prisma.contestQuestion.findMany({
            where: { contestId, organizationId },
            select: {
                questionId: true,
                marks: true,
                negativeMark: true,
                question: {
                    select: {
                        options: {
                            where: { isCorrect: true },
                            select: { id: true },
                            take: 1,
                        },
                    },
                },
            },
        });

        return rows
            .filter((r) => r.question.options.length > 0)
            .map((r) => ({
                questionId: r.questionId,
                marks: r.marks,
                negativeMark: r.negativeMark ? r.negativeMark.toString() : "0",
                correctOptionId: r.question.options[0]!.id,
            }));
    }

    async getDistinctTags(organizationId: string): Promise<string[]> {
        const rows = await prisma.$queryRaw<Array<{ tag: string }>>`
            SELECT DISTINCT UNNEST(tags) AS tag
            FROM questions
            WHERE "organizationId" = ${organizationId}
              AND "isDeleted" = false
            ORDER BY tag ASC
        `;
        return rows.map((r) => r.tag);
    }
}