import { Contest, ContestStatus, PaymentConfig, Prisma, Prize } from "@prisma/client";
import { ContestSummary, CreateContestDTO, ListContestsFilter, UpdateContestDTO } from "./contest.types";
import { prisma } from "../../config/db";
import { stripUndefined } from "../../common/utils/prisma.utils";

export type ContestWithRelation = Contest & {
    prizes: Prize[];
    paymentConfig: PaymentConfig | null;
}


export interface IContestRepository {
    create(organizationId: string, createdById: string, data: CreateContestDTO): Promise<ContestWithRelation>;
    findById(contestId: string, organizationId?: string): Promise<ContestWithRelation | null>;
    findBySlug(slug: string, organizationId: string): Promise<Contest | null>;
    findBySlugPublic(slug: string): Promise<Contest | null>;
    list(organizationId: string, query: ListContestsFilter): Promise<{ data: ContestSummary[]; total: number }>;
    update(contestId: string, organizationId: string, data: UpdateContestDTO): Promise<Contest>;
    updateStatus(contestId: string, organizationId: string, status: ContestStatus, joinCode?: string): Promise<any>;
    listByIds(ids: string[], organizationId: string, status?: ContestStatus): Promise<{ total: number }>;
    softDelete(contestId: string, organizationId: string): Promise<void>;
    archive(contestId: string, organizationId: string): Promise<void>;
    countQuestions(contestId: string): Promise<number>;
    countParticipants(contestId: string): Promise<number>;
}

export class ContestRepository implements IContestRepository {

    async create(organizationId: string, createdById: string, data: CreateContestDTO): Promise<ContestWithRelation> {
        const { prizes, paymentConfig, ...contestData } = data;

        return await prisma.$transaction(async (tx) => {
            // 1. Create the contest
            const contest = await tx.contest.create({
                data: {
                    organizationId,
                    createdById,
                    title: contestData.title,
                    slug: contestData.slug,
                    description: contestData.description ?? null,
                    details: contestData.details ?? null,
                    topics: contestData.topics ?? [],
                    rules: contestData.rules ?? [],
                    duration: contestData.duration,
                    cutoffScore: contestData.cutoffScore ?? null,
                    maxParticipants: contestData.maxParticipants ?? null,
                    registrationDeadline: contestData.registrationDeadline,
                    startTime: contestData.startTime,
                    endTime: contestData.endTime,
                    paymentEnabled: contestData.paymentEnabled ?? false,
                    shuffleQuestions: contestData.shuffleQuestions ?? true,
                    shuffleOptions: contestData.shuffleOptions ?? false,
                    proctoringEnabled: contestData.proctoringEnabled ?? true,
                    showResultsAfter: contestData.showResultsAfter ?? 24,
                    bannerImage: contestData.bannerImage ?? null,
                }
            });

            // 2. Create the payment config if enabled
            if (paymentConfig && data.paymentEnabled) {
                await tx.paymentConfig.create({
                    data: {
                        contestId: contest.id,
                        amount: paymentConfig.amount,
                        currency: paymentConfig.currency,
                        description: paymentConfig.description ?? null,
                    }
                });
            }

            // 3. Create the prizes
            if (prizes && prizes.length > 0) {
                await tx.prize.createMany({
                    data: prizes.map(p => ({
                        organizationId,          // ← add this
                        contestId: contest.id,
                        rankFrom: p.rankFrom,
                        rankTo: p.rankTo,
                        amount: p.amount,
                        currency: p.currency ?? 'INR',
                        label: p.label ?? null,
                        benefits: p.benefits ?? [],
                    }))
                });
            }

            // 4. Return the contest with its relationships
            const contestWithRelations = await tx.contest.findUnique({
                where: { id: contest.id },
                include: { prizes: true, paymentConfig: true },
            });

            if (!contestWithRelations) {
                throw new Error("Failed to fetch created contest with relations");
            }

            return contestWithRelations as ContestWithRelation;
        });
    }

    async findById(contestId: string, organizationId?: string): Promise<ContestWithRelation | null> {
        return await prisma.contest.findFirst({
            where: {
                id: contestId,
                ...(organizationId ? { organizationId } : {}),
                isDeleted: false,
            },
            include: {
                prizes: true,
                paymentConfig: true,
                _count: {
                    select: {
                        participants: true,
                        submissions: true,
                        payments: true,
                        questions: true,
                    }
                }
            }
        });
    }

    async findBySlug(slug: string, organizationId: string): Promise<Contest | null> {
        return await prisma.contest.findFirst({
            where: { slug, organizationId },
            include: { _count: { select: { participants: true } }, paymentConfig: true }
        })
    }

    async findBySlugPublic(slug: string): Promise<ContestWithRelation | null> {
        return await prisma.contest.findFirst({
            where: {
                slug,
                isDeleted: false,
                status: {
                    in: [
                        ContestStatus.PUBLISHED,
                        ContestStatus.REGISTRATION_CLOSED,
                        ContestStatus.LIVE,
                        ContestStatus.EVALUATION,
                        ContestStatus.RESULTS_OUT,
                        ContestStatus.COMPLETED,
                        ContestStatus.CANCELLED,
                    ],
                },
            },
            include: {
                prizes: true,
                paymentConfig: true,
                organization: { select: { name: true, logoUrl: true } },
                _count: { select: { participants: true, questions: true } },
            },
        });
    }

    async list(organizationId: string, query: ListContestsFilter): Promise<{ data: ContestSummary[]; total: number }> {
        const { status, search } = query;
        const page = query.page || 1;
        const limit = query.limit || 10;
        const skip = (page - 1) * limit;

        const where: Prisma.ContestWhereInput = {
            organizationId,
            isDeleted: false,
            isArchived: query.isArchived ?? false,
            ...(status ? { status } : {}),
            ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        };

        const [contests, total] = await prisma.$transaction([
            prisma.contest.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    status: true,
                    startTime: true,
                    registrationDeadline: true,
                    paymentEnabled: true,
                    paymentConfig: true,
                    _count: { select: { participants: true } },
                },
            }),
            prisma.contest.count({ where })
        ]);

        const formattedContests: ContestSummary[] = contests.map((contest: any) => ({
            id: contest.id,
            title: contest.title,
            slug: contest.slug,
            status: contest.status,
            startTime: contest.startTime,
            registrationDeadline: contest.registrationDeadline,
            registrationCount: contest._count.participants,
            paymentEnabled: contest.paymentEnabled,
            paymentConfig: contest.paymentConfig,
        }))

        return { data: formattedContests, total };
    }

    async update(contestId: string, organizationId: string, data: UpdateContestDTO): Promise<Contest> {
        const { prizes, paymentConfig, ...contestData } = data;

        const parsed: any = stripUndefined(contestData);

        if (data.registrationDeadline) parsed.registrationDeadline = new Date(data.registrationDeadline);
        if (data.startTime) parsed.startTime = new Date(data.startTime);

        if (paymentConfig !== undefined) {
            if (paymentConfig === null) {
                parsed.paymentConfig = { delete: true };
            } else {
                parsed.paymentConfig = {
                    upsert: {
                        create: stripUndefined(paymentConfig),
                        update: stripUndefined(paymentConfig)
                    }
                };
            }
        }

        if (prizes) {
            parsed.prizes = {
                deleteMany: {},
                create: prizes.map(prize => {
                    return stripUndefined(prize);
                })
            };
        }

        return await prisma.contest.update({
            where: { id: contestId, organizationId },
            data: parsed,
            include: { paymentConfig: true, prizes: true }
        });
    }

    async updateStatus(contestId: string, organizationId: string, status: ContestStatus, joinCode?: string) {
        return await prisma.contest.update({
            where: { id: contestId, organizationId },
            data: {
                status,
                ...(joinCode ? { joinCode } : {})
            },
        });
    }

    async softDelete(contestId: string, organizationId: string): Promise<void> {
        await prisma.contest.update({
            where: { id: contestId, organizationId },
            data: { isDeleted: true },
        });
    }

    async archive(contestId: string, organizationId: string): Promise<void> {
        await prisma.contest.update({
            where: { id: contestId, organizationId },
            data: { isArchived: true },
        });
    }

    async listByIds(ids: string[], organizationId: string, status?: ContestStatus) {
        const where: Prisma.ContestWhereInput = {
            id: { in: ids },
            organizationId,
            isDeleted: false,
            ...(status ? { status } : {}),
        };
        const total = await prisma.contest.count({ where });
        return { total };
    }

    async countQuestions(contestId: string): Promise<number> {
        return await prisma.contestQuestion.count({ where: { contestId } });
    }

    async countParticipants(contestId: string): Promise<number> {
        return await prisma.participant.count({ where: { contestId } });
    }

    async findManyPublic(args: {
        where: Prisma.ContestWhereInput;
        skip: number;
        take: number;
        orderBy: Prisma.ContestOrderByWithRelationInput;
    }) {
        return await prisma.contest.findMany({
            where: args.where,
            skip: args.skip,
            take: args.take,
            orderBy: args.orderBy,
            select: {
                id: true,
                title: true,
                slug: true,
                description: true,
                topics: true,
                startTime: true,
                registrationDeadline: true,
                duration: true,
                maxParticipants: true,
                paymentEnabled: true,
                paymentConfig: true,
                status: true,
                prizes: true,
                cutoffScore: true,
                showResultsAfter: true,
                _count: { select: { participants: true, questions: true } },
            },
        });
    }

    async countPublic(where: Prisma.ContestWhereInput): Promise<number> {
        return await prisma.contest.count({ where });
    }
}