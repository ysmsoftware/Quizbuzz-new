import { Contact, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { FindContactsFilter, UpdateContactInput, UpsertContactInput, } from "./contact.types";

export class ContactRepository {

    async findById(id: string, organizationId: string): Promise<Contact | null> {
        return prisma.contact.findFirst({
            where: { id, organizationId, isDeleted: false },
        });
    }

    async findByEmail(email: string, organizationId: string): Promise<Contact | null> {
        // Uses the @@unique([organizationId, email]) index directly — faster than findFirst
        const contact = await prisma.contact.findUnique({
            where: { organizationId_email: { organizationId, email } },
        });
        // Respect soft-delete: unique index doesn't filter isDeleted
        return contact && !contact.isDeleted ? contact : null;
    }

    async findByPhone(phone: string, organizationId: string): Promise<Contact | null> {
        // Uses the @@unique([organizationId, phone]) index directly — faster than findFirst
        const contact = await prisma.contact.findUnique({
            where: { organizationId_phone: { organizationId, phone } },
        });
        // Respect soft-delete: unique index doesn't filter isDeleted
        return contact && !contact.isDeleted ? contact : null;
    }

    async findByEmailOrPhone(organizationId: string, email?: string, phone?: string): Promise<Contact | null> {
        if (!email && !phone) return null;
        return prisma.contact.findFirst({
            where: {
                organizationId,
                isDeleted: false,
                OR: [
                    ...(email ? [{ email }] : []),
                    ...(phone ? [{ phone }] : []),
                ],
            },
        });
    }

    async findAll(filter: FindContactsFilter): Promise<{
        rows: (Contact & { _count: { participants: number } })[];
        total: number;
    }> {
        const where = this._buildWhereClause(filter);

        const [rows, total] = await prisma.$transaction([
            prisma.contact.findMany({
                where,
                skip: filter.skip,
                take: filter.take,
                orderBy: { createdAt: "desc" },
                include: {
                    _count: { select: { participants: true } },
                },
            }),
            prisma.contact.count({ where }),
        ]);

        return { rows, total };
    }

    // Write operations


    async create(data: {
        organizationId: string;
        email: string;
        phone?: string | null | undefined;
        firstName: string;
        lastName?: string | null | undefined;
        college?: string | null | undefined;
        department?: string | null | undefined;
        city?: string | null | undefined;
        state?: string | null | undefined;
    }): Promise<Contact> {
        return prisma.contact.create({
            data: {
                organizationId: data.organizationId,
                email: data.email,
                phone: data.phone ?? null,
                firstName: data.firstName,
                lastName: data.lastName ?? null,
                college: data.college ?? null,
                department: data.department ?? null,
                city: data.city ?? null,
                state: data.state ?? null,
            },
        });
    }

    async upsertByEmail(input: UpsertContactInput): Promise<Contact> {
        return prisma.contact.upsert({
            where: {
                organizationId_email: {
                    organizationId: input.organizationId,
                    email: input.email,
                },
            },
            create: {
                organizationId: input.organizationId,
                email: input.email,
                phone: input.phone ?? null,
                firstName: input.firstName,
                lastName: input.lastName ?? null,
                college: input.college ?? null,
                department: input.department ?? null,
                city: input.city ?? null,
                state: input.state ?? null,
            },
            update: {
                // Never overwrite with empty/undefined — only update when value is present
                ...(input.phone !== undefined && { phone: input.phone }),
                ...(input.firstName !== undefined && { firstName: input.firstName }),
                ...(input.lastName !== undefined && { lastName: input.lastName }),
                ...(input.college !== undefined && { college: input.college }),
                ...(input.department !== undefined && { department: input.department }),
                ...(input.city !== undefined && { city: input.city }),
                ...(input.state !== undefined && { state: input.state }),
            },
        });
    }

    async updateById(id: string, organizationId: string, data: UpdateContactInput): Promise<Contact> {
        return prisma.contact.update({
            where: { id, organizationId },
            data: {
                ...(data.phone !== undefined && { phone: data.phone }),
                ...(data.firstName !== undefined && { firstName: data.firstName }),
                ...(data.lastName !== undefined && { lastName: data.lastName }),
                ...(data.college !== undefined && { college: data.college }),
                ...(data.department !== undefined && { department: data.department }),
                ...(data.city !== undefined && { city: data.city }),
                ...(data.state !== undefined && { state: data.state }),
            },
        });
    }

    async softDeleteById(id: string, organizationId: string): Promise<void> {
        await prisma.contact.update({
            where: { id, organizationId },
            data: { isDeleted: true },
        });
    }

    // Relation read-throughs
    async findContestsByContactId(contactId: string, organizationId: string) {
        return prisma.contact.findFirst({
            where: { id: contactId, organizationId, isDeleted: false },
            select: {
                participants: {
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        registrationRef: true,
                        status: true,
                        createdAt: true,
                        contest: {
                            select: {
                                id: true,
                                title: true,
                                slug: true,
                                paymentConfig: {
                                    select: {
                                        amount: true
                                    }
                                }
                            },
                        },
                        payment: {
                            select: {
                                status: true,
                                amount: true
                            }
                        },
                        certificate: {
                            select: {
                                id: true,
                                status: true,
                                generatedAt: true,
                                fileUrl: true
                            }
                        },
                        submission: {
                            select: {
                                score: true,
                                percentage: true
                            }
                        },
                        leaderboard: {
                            select: {
                                rank: true
                            }
                        }
                    },
                },
            },
        });
    }



    // Private helpers

    private _buildWhereClause(filter: FindContactsFilter): Prisma.ContactWhereInput {
        const where: Prisma.ContactWhereInput = {
            organizationId: filter.organizationId,
            isDeleted: false,
        };

        if (filter.city) where.city = { equals: filter.city, mode: "insensitive" };
        if (filter.state) where.state = { equals: filter.state, mode: "insensitive" };
        if (filter.college) where.college = { equals: filter.college, mode: "insensitive" };

        if (filter.search) {
            where.OR = [
                { firstName: { contains: filter.search, mode: "insensitive" } },
                { lastName: { contains: filter.search, mode: "insensitive" } },
                { email: { contains: filter.search, mode: "insensitive" } },
                { phone: { contains: filter.search, mode: "insensitive" } },
            ];
        }

        return where;
    }
}