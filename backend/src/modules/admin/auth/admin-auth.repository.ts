import { Admin, AdminRefreshToken, Organization, OrgMember, OrgMemberRole } from "@prisma/client";
import { prisma } from "../../../config/db";
import { CreateAdminInput, CreateRefreshTokenInput } from "./admin-auth.types";


export class AdminAuthRepository {
 
    // admin 
    async findByEmail(email: string): Promise<Admin | null> {
        return prisma.admin.findUnique({
            where: { email }
        });
    };

    async findById(id: string): Promise<Admin | null> {
        return prisma.admin.findUnique({
            where: { id }
        });
    };

    async create(input: CreateAdminInput): Promise<Admin> {
        return prisma.admin.create({
            data: input
        });
    }
    async updateById(id: string, data: Partial<Admin>): Promise<Admin> {
        return prisma.admin.update({
            where: { id },
            data,
        });
    }

    // Token
    async createRefreshToken(input: CreateRefreshTokenInput): Promise<AdminRefreshToken> {
        return prisma.adminRefreshToken.create({
            data: input,
        });
    }

    async findRefreshTokenByHash(hash: string): Promise<AdminRefreshToken | null> {
        return prisma.adminRefreshToken.findUnique({
            where: { tokenHash: hash }
        });
    }

    async revokeRefreshToken(hash: string): Promise<void> {
        await prisma.adminRefreshToken.update({
            where: { tokenHash: hash },
            data:  { revokedAt: new Date() },
        });
    }

    async revokeAllRefreshTokenByAdmin(adminId: string): Promise<void> {
        await prisma.adminRefreshToken.updateMany({
            where: {adminId, revokedAt: null },
            data:  { revokedAt: new Date() },
        });
    }

    async createWithOrganization(input: {
        adminData: CreateAdminInput;
        orgData: { name: string; slug: string };
    }): Promise<{ admin: Admin; organization: Organization }> {
        
        return prisma.$transaction(async (tx) => {
            // 1. Create the admin
            const admin = await tx.admin.create({
                data: input.adminData,
            });

            // 2. Create the organization
            const organization = await tx.organization.create({
                data: {
                    name: input.orgData.name,
                    slug: input.orgData.slug,
                },
            });

            // 3. Wire them together as OWNER
            await tx.orgMember.create({
                data: {
                    adminId: admin.id,
                    organizationId: organization.id,
                    role: OrgMemberRole.OWNER,
                    acceptedAt: new Date(), // auto-accepted — they created it
                },
            });

            return { admin, organization };
        });
    }




}