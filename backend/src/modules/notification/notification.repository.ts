import { OrgMemberNotificationPreference } from "@prisma/client";
import { prisma } from "../../config/db";

export class NotificationRepository {
    async findPreferences(orgMemberIds: string[]): Promise<OrgMemberNotificationPreference[]> {
        if (orgMemberIds.length === 0) return [];
        return prisma.orgMemberNotificationPreference.findMany({ where: { orgMemberId: { in: orgMemberIds } } });
    }

    async upsertPreferences(orgMemberId: string, prefs: { type: string; email: boolean }[]): Promise<void> {
        await prisma.$transaction(
            prefs.map((p) =>
                prisma.orgMemberNotificationPreference.upsert({
                    where: { orgMemberId_type: { orgMemberId, type: p.type } },
                    create: { orgMemberId, type: p.type, email: p.email },
                    update: { email: p.email },
                }),
            ),
        );
    }
}
