import { z } from "zod";
import { QuestionDifficulty } from "@prisma/client";

// ─── Option ───────────────────────────────────────────────────────────────────

const CreateOptionSchema = z.object({
    text: z.string().min(1).max(500),
    isCorrect: z.boolean(),
    position: z.number().int().min(0).max(9),
});

const UpdateOptionSchema = z.object({
    id: z.string().optional(), // present = update; absent = new option
    text: z.string().min(1).max(500),
    isCorrect: z.boolean(),
    position: z.number().int().min(0).max(9),
});



function validateOptions(options: { isCorrect: boolean; position: number }[], ctx: z.RefinementCtx) {
    const correctCount = options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Exactly one option must be marked as correct",
            path: ["options"],
        });
    }

    const positions = options.map((o) => o.position);
    const uniquePositions = new Set(positions);
    if (uniquePositions.size !== positions.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Option positions must be unique",
            path: ["options"],
        });
    }
}



export const CreateQuestionSchema = z
    .object({
        questionText: z.string().min(5).max(2000),
        difficulty: z.nativeEnum(QuestionDifficulty),
        hint: z.string().max(500).optional(),
        explanation: z.string().max(2000).optional(),
        tags: z.array(z.string().min(1).max(50)).max(10).default([]),
        options: z.array(CreateOptionSchema).min(2).max(6),
    })
    .superRefine((data, ctx) => {
        validateOptions(data.options, ctx);
    });


export const UpdateQuestionSchema = z
    .object({
        questionText: z.string().min(5).max(2000).optional(),
        difficulty: z.nativeEnum(QuestionDifficulty).optional(),
        hint: z.string().max(500).nullable().optional(),
        explanation: z.string().max(2000).nullable().optional(),
        tags: z.array(z.string().min(1).max(50)).max(10).optional(),
        // When provided, options replace ALL existing options for this question
        options: z.array(UpdateOptionSchema).min(2).max(6).optional(),
    })
    .superRefine((data, ctx) => {
        if (data.options) {
            validateOptions(data.options, ctx);
        }
    });



export const BulkCreateQuestionsSchema = z.object({
    questions: z
        .array(CreateQuestionSchema)
        .min(1)
        .max(500), // hard limit per request per engineering guidelines
});


export const ListQuestionsQuerySchema = z.object({
    difficulty: z.nativeEnum(QuestionDifficulty).optional(),
    tags: z.string().optional(),          // comma-separated: "React,Hooks"
    search: z.string().max(200).optional(),
    contestId: z.string().optional(),
    unassignedFor: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});


export const AssignQuestionsSchema = z.object({
    questions: z
        .array(
            z.object({
                questionId: z.string().min(1),
                position: z.number().int().positive(),
                marks: z.number().int().min(1).default(1),
                negativeMark: z.number().min(0).max(10).default(0),
            })
        )
        .min(1)
        .max(500),
});

// Positions must be unique across the batch
export const AssignQuestionsWithPositionCheckSchema = AssignQuestionsSchema.superRefine(
    (data, ctx) => {
        const positions = data.questions.map((q) => q.position);
        const uniquePositions = new Set(positions);
        if (uniquePositions.size !== positions.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Each question must have a unique position value",
                path: ["questions"],
            });
        }
    }
);


export const ReorderQuestionsSchema = z.object({
    order: z.array(z.string().min(1)).min(1).max(500),
})



export const UpdateContestQuestionSchema = z.object({
    marks: z.number().int().min(1).optional(),
    negativeMark: z.number().min(0).max(10).optional(),
});

export const AutoGenerateQuestionsSchema = z.object({
    totalQuestions: z.number().int().min(1).max(500),
    rules: z.array(
        z.object({
            tags: z.array(z.string().min(1).max(50)),
            percentage: z.number().min(1).max(100),
            difficultyBreakdown: z.object({
                EASY: z.number().min(0).max(100),
                MEDIUM: z.number().min(0).max(100),
                HARD: z.number().min(0).max(100),
            }).superRefine((data, ctx) => {
                const total = data.EASY + data.MEDIUM + data.HARD;
                if (total !== 100) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "Difficulty breakdown percentages must sum to 100%",
                        path: ["EASY"],
                    });
                }
            })
        })
    ).min(1).superRefine((rules, ctx) => {
        const totalPercentage = rules.reduce((acc, rule) => acc + rule.percentage, 0);
        if (totalPercentage !== 100) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Rule percentages must sum to 100%",
                path: [],
            });
        }
    })
});

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;
export type BulkCreateQuestionsInput = z.infer<typeof BulkCreateQuestionsSchema>;
export type ListQuestionsQueryInput = z.infer<typeof ListQuestionsQuerySchema>;
export type AssignQuestionsInput = z.infer<typeof AssignQuestionsSchema>;
export type ReorderQuestionsInput = z.infer<typeof ReorderQuestionsSchema>;
export type UpdateContestQuestionInput = z.infer<typeof UpdateContestQuestionSchema>;
export type AutoGenerateQuestionsInput = z.infer<typeof AutoGenerateQuestionsSchema>;