import { Ambassador, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { CreateAmbassadorInput } from "./ambassador.types";

export class AmbassadorRepository {

    async findById(id: string): Promise<Ambassador | null> {
        return prisma.ambassador.findUnique({ where: { id } });
    }

    async findByEmail(email: string): Promise<Ambassador | null> {
        return prisma.ambassador.findUnique({ where: { email } });
    }

    async update(id: string, data: Partial<Pick<Ambassador, "firstName" | "lastName" | "phone" | "proofStorageKey" | "proofUrl">>): Promise<Ambassador> {
        return prisma.ambassador.update({ where: { id }, data });
    }

    async create(data: CreateAmbassadorInput): Promise<Ambassador> {
        return prisma.ambassador.create({
            data: {
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
}
