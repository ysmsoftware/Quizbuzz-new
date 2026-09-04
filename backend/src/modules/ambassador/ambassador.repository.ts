import { Ambassador, AmbassadorRefreshToken, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { CreateAmbassadorInput, CreateRefreshTokenInput } from "./ambassador.types";

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

    // ─── Refresh tokens (§7.1) — same pattern as AdminAuthRepository's admin_refresh_tokens ──

    async createRefreshToken(input: CreateRefreshTokenInput): Promise<AmbassadorRefreshToken> {
        return prisma.ambassadorRefreshToken.create({ data: input });
    }

    async findRefreshTokenByHash(hash: string): Promise<AmbassadorRefreshToken | null> {
        return prisma.ambassadorRefreshToken.findUnique({ where: { tokenHash: hash } });
    }

    async revokeRefreshToken(hash: string): Promise<void> {
        await prisma.ambassadorRefreshToken.update({
            where: { tokenHash: hash },
            data: { revokedAt: new Date() },
        });
    }

    async revokeAllRefreshTokenByAmbassador(ambassadorId: string): Promise<void> {
        await prisma.ambassadorRefreshToken.updateMany({
            where: { ambassadorId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
}
