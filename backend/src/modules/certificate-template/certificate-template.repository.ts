import { prisma } from "../../config/db";
import {
    CertificateTemplateResult,
    CreateCertificateTemplateInput,
    UpdateCertificateTemplateInput,
} from "./certificate-template.types";

export class CertificateTemplateRepository {

    async findAllByOrg(organizationId: string): Promise<CertificateTemplateResult[]> {
        const rows = await prisma.certificateTemplate.findMany({
            where: { organizationId },
            orderBy: { name: "asc" },
        });
        return rows.map(this._toResult);
    }

    async findById(id: string, organizationId: string): Promise<CertificateTemplateResult | null> {
        const row = await prisma.certificateTemplate.findFirst({ where: { id, organizationId } });
        return row ? this._toResult(row) : null;
    }

    async create(input: CreateCertificateTemplateInput): Promise<CertificateTemplateResult> {
        const row = await prisma.certificateTemplate.create({
            data: {
                organizationId: input.organizationId,
                name:           input.name,
                description:    input.description ?? null,
                htmlContent:    input.htmlContent,
                variables:      input.variables as any,
            },
        });
        return this._toResult(row);
    }

    async update(
        id: string,
        organizationId: string,
        input: UpdateCertificateTemplateInput
    ): Promise<CertificateTemplateResult> {
        const row = await prisma.certificateTemplate.update({
            where: { id },
            data: {
                organizationId,
                ...(input.name        !== undefined && { name: input.name }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.htmlContent !== undefined && { htmlContent: input.htmlContent }),
                ...(input.variables   !== undefined && { variables: input.variables as any }),
                updatedAt: new Date(),
            },
        });
        return this._toResult(row);
    }

    async delete(id: string, organizationId: string): Promise<void> {
        await prisma.certificateTemplate.deleteMany({ where: { id, organizationId } });
    }

    private _toResult(row: any): CertificateTemplateResult {
        return {
            id:             row.id,
            organizationId: row.organizationId,
            name:           row.name,
            description:    row.description ?? null,
            htmlContent:    row.htmlContent,
            variables:      (row.variables as string[]) ?? [],
            createdAt:      row.createdAt,
            updatedAt:      row.updatedAt,
        };
    }
}
