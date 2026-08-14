import { Ambassador, AmbassadorStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { CreateAmbassadorInput, FindAmbassadorsFilter } from "./ambassador.types";

export class AmbassadorRepository {

    async findById(id: string, organizationId: string): Promise<Ambassador | null> {
        return prisma.ambassador.findFirst({ where: { id, organizationId } });
    }

    async findByEmail(email: string, organizationId: string): Promise<Ambassador | null> {
        return prisma.ambassador.findUnique({
            where: { organizationId_email: { organizationId, email } },
        });
    }

    async create(data: CreateAmbassadorInput): Promise<Ambassador> {
        return prisma.ambassador.create({
            data: {
                organizationId: data.organizationId,
                email: data.email,
                phone: data.phone ?? null,
                firstName: data.firstName,
                lastName: data.lastName ?? null,
                ambassadorType: data.ambassadorType,
                applicationData: data.applicationData as Prisma.InputJsonValue,
                proofStorageKey: data.proofStorageKey,
                proofUrl: data.proofUrl,
            },
        });
    }

    async findAll(filter: FindAmbassadorsFilter): Promise<{ rows: Ambassador[]; total: number }> {
        const where: Prisma.AmbassadorWhereInput = {
            organizationId: filter.organizationId,
            ...(filter.statuses && filter.statuses.length > 0
                ? { status: { in: filter.statuses as AmbassadorStatus[] } }
                : {}),
        };

        const [rows, total] = await prisma.$transaction([
            prisma.ambassador.findMany({
                where,
                skip: filter.skip,
                take: filter.take,
                orderBy: { [filter.sortBy]: filter.sortOrder },
            }),
            prisma.ambassador.count({ where }),
        ]);

        return { rows, total };
    }

    async updateStatus(
        id: string,
        organizationId: string,
        data: { status: AmbassadorStatus; reviewedById?: string; rejectionReason?: string | null },
    ): Promise<Ambassador> {
        return prisma.ambassador.update({
            where: { id, organizationId },
            data: { ...data, reviewedAt: new Date() },
        });
    }
}
