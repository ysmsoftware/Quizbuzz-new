import { OrgMemberRole } from "@prisma/client";
import { OrganizationRepository } from "../organization/organization.repository";
import { MessagingService } from "../messaging/messaging.service";
import { MessageTemplate } from "../../types/message-template.enum";
import { TemplateParamsMap } from "../../types/message-template";
import { isFeatureEnabled } from "../../common/feature-flags";
import { NotFoundError } from "../../error/http-errors";
import logger from "../../config/logger";
import { NotificationRepository } from "./notification.repository";
import { ORG_NOTIFICATIONS, OrgNotificationType, isOrgNotificationType } from "./notification.registry";

export interface NotificationPreferenceItem {
    type: OrgNotificationType;
    category: string;
    label: string;
    description: string;
    email: boolean;
}

export interface NotificationRecipient {
    firstName: string;
    email: string;
}

type FlagChecker = (key: string, ctx: { organizationId: string }) => Promise<boolean>;

export class NotificationService {
    constructor(
        private readonly notificationRepo: NotificationRepository,
        private readonly organizationRepo: OrganizationRepository,
        private readonly messagingService: MessagingService,
        private readonly flagEnabled: FlagChecker = isFeatureEnabled,
    ) { }

    /** Registry types this role may receive in this org — the single place role + feature-flag
     *  gating is decided, shared by GET/PUT preferences and notifyOrg. */
    private async _availableTypes(organizationId: string, role: OrgMemberRole): Promise<OrgNotificationType[]> {
        const types = Object.keys(ORG_NOTIFICATIONS) as OrgNotificationType[];
        const allowed = await Promise.all(
            types.map(async (type) => {
                const def = ORG_NOTIFICATIONS[type];
                if (!(def.roles as readonly OrgMemberRole[]).includes(role)) return false;
                return def.featureFlag ? this.flagEnabled(def.featureFlag, { organizationId }) : true;
            }),
        );
        return types.filter((_, i) => allowed[i]);
    }

    /**
     * Enqueues an email (via the messaging queue — logged in MessageLog, subject to the
     * mailbox cap) for every opted-in, eligible member of the org. Never throws — safe to call
     * un-awaited from a request handler (one failed enqueue is logged and doesn't stop the rest).
     */
    async notifyOrg<T extends MessageTemplate>(
        organizationId: string,
        type: OrgNotificationType,
        template: T,
        buildParams: (recipient: NotificationRecipient) => TemplateParamsMap[T],
    ): Promise<void> {
        try {
            const def = ORG_NOTIFICATIONS[type];
            if (def.featureFlag && !(await this.flagEnabled(def.featureFlag, { organizationId }))) return;

            const members = (await this.organizationRepo.findOrgMembers(organizationId)).filter(
                (m) => m.isActive && (def.roles as readonly OrgMemberRole[]).includes(m.role),
            );
            const prefs = await this.notificationRepo.findPreferences(members.map((m) => m.id));
            const stored = new Map(prefs.filter((p) => p.type === type).map((p) => [p.orgMemberId, p.email]));
            const recipients = members.filter((m) => stored.get(m.id) ?? def.defaults.email);

            const results = await Promise.allSettled(
                recipients.map((m) =>
                    this.messagingService.enqueueMessage(organizationId, {
                        template,
                        recipient: m.admin.email,
                        params: buildParams({ firstName: m.admin.firstName, email: m.admin.email }) as Record<string, any>,
                    }),
                ),
            );
            results.forEach((r, i) => {
                if (r.status === "rejected") {
                    logger.error(`[notification] ${type} enqueue for ${recipients[i]!.admin.email} failed: ${(r.reason as Error)?.message}`);
                }
            });
        } catch (err) {
            logger.error(`[notification] notifyOrg(${type}) failed for org ${organizationId}: ${(err as Error).message}`);
        }
    }

    async getPreferences(organizationId: string, adminId: string): Promise<NotificationPreferenceItem[]> {
        const member = await this._requireMembership(organizationId, adminId);
        const types = await this._availableTypes(organizationId, member.role);
        const stored = new Map((await this.notificationRepo.findPreferences([member.id])).map((p) => [p.type, p.email]));

        return types.map((type) => {
            const { category, label, description, defaults } = ORG_NOTIFICATIONS[type];
            return { type, category, label, description, email: stored.get(type) ?? defaults.email };
        });
    }

    async updatePreferences(
        organizationId: string,
        adminId: string,
        prefs: { type: string; email: boolean }[],
    ): Promise<NotificationPreferenceItem[]> {
        const member = await this._requireMembership(organizationId, adminId);
        const available = new Set<string>(await this._availableTypes(organizationId, member.role));
        // 404 (not 400/403) for anything this member can't see — no signal that a flagged feature exists.
        for (const p of prefs) {
            if (!isOrgNotificationType(p.type) || !available.has(p.type)) throw new NotFoundError("Not found");
        }
        await this.notificationRepo.upsertPreferences(member.id, prefs);
        return this.getPreferences(organizationId, adminId);
    }

    private async _requireMembership(organizationId: string, adminId: string) {
        const member = await this.organizationRepo.findOrgMembership(adminId, organizationId);
        if (!member || !member.isActive) throw new NotFoundError("Organization not found");
        return member;
    }
}
