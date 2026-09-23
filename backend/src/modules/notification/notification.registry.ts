import { OrgMemberRole } from "@prisma/client";

/**
 * Every org-admin notification type, in one place. Adding a notification =
 *   1. an entry here,
 *   2. a MessageTemplate + TemplateParamsMap entry + EmailTemplates builder,
 *   3. a notificationService.notifyOrg(...) call where the event happens.
 * The settings UI (Settings → Notifications) renders whatever GET /notification-preferences
 * returns, so it needs no change, and preferences are keyed by these string keys, so no migration.
 */
export interface OrgNotificationDefinition {
    category: string;
    label: string;
    description: string;
    /** Roles eligible to receive it at all — others never see the toggle or the email. */
    roles: readonly OrgMemberRole[];
    /** When set, the type only exists for orgs with this feature flag on (see common/feature-flags.ts). */
    featureFlag?: string;
    defaults: { email: boolean };
}

export const ORG_NOTIFICATIONS = {
    AMBASSADOR_APPLICATION_SUBMITTED: {
        category: "Ambassadors",
        label: "New ambassador applications",
        description: "Email me when someone applies (or reapplies) to one of our campaigns.",
        roles: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN],
        featureFlag: "ambassador_program_enabled",
        defaults: { email: true },
    },
} satisfies Record<string, OrgNotificationDefinition>;

export type OrgNotificationType = keyof typeof ORG_NOTIFICATIONS;

export function isOrgNotificationType(key: string): key is OrgNotificationType {
    return Object.prototype.hasOwnProperty.call(ORG_NOTIFICATIONS, key);
}
