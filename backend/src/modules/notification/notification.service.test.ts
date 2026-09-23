import { OrgMemberRole } from "@prisma/client";
import { NotificationService } from "./notification.service";
import { MessageTemplate } from "../../types/message-template.enum";

jest.mock("../../config/logger", () => ({ __esModule: true, default: { error: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

const member = (id: string, role: OrgMemberRole, email: string) => ({
    id, role, isActive: true, adminId: `a-${id}`, organizationId: "org1",
    admin: { id: `a-${id}`, email, firstName: id, lastName: "", avatarUrl: null },
});

function makeService({ flagOn = true, stored = [] as { orgMemberId: string; type: string; email: boolean }[], failFor = "" } = {}) {
    const members = [
        member("owner", OrgMemberRole.OWNER, "owner@x.com"),
        member("admin", OrgMemberRole.ADMIN, "admin@x.com"),
        member("viewer", OrgMemberRole.VIEWER, "viewer@x.com"),
    ];
    const notificationRepo = {
        findPreferences: jest.fn().mockImplementation((ids: string[]) => Promise.resolve(stored.filter((p) => ids.includes(p.orgMemberId)))),
        upsertPreferences: jest.fn().mockResolvedValue(undefined),
    };
    const organizationRepo = {
        findOrgMembers: jest.fn().mockResolvedValue(members),
        findOrgMembership: jest.fn().mockImplementation((adminId: string) => Promise.resolve(members.find((m) => m.adminId === adminId) ?? null)),
    };
    const messagingService = {
        enqueueMessage: jest.fn().mockImplementation((_org: string, opts: { recipient: string }) =>
            opts.recipient === failFor ? Promise.reject(new Error("redis")) : Promise.resolve()),
    };
    const service = new NotificationService(notificationRepo as any, organizationRepo as any, messagingService as any, () => Promise.resolve(flagOn));
    return { service, emailProvider: messagingService, notificationRepo };
}

const notify = (service: NotificationService) =>
    service.notifyOrg("org1", "AMBASSADOR_APPLICATION_SUBMITTED", MessageTemplate.AMBASSADOR_APPLICATION_SUBMITTED_ADMIN, (r) => ({
        name: r.firstName, ambassadorName: "A", ambassadorEmail: "a@x.com", ambassadorType: "Student",
        campaignName: "C", orgName: "O", reviewLink: "http://x", isReapplication: false,
    }));

const recipients = (messaging: { enqueueMessage: jest.Mock }) => messaging.enqueueMessage.mock.calls.map((c) => c[1].recipient).sort();

describe("NotificationService", () => {
    it("emails OWNER + ADMIN by default, never VIEWER", async () => {
        const { service, emailProvider } = makeService();
        await notify(service);
        expect(recipients(emailProvider)).toEqual(["admin@x.com", "owner@x.com"]);
    });

    it("respects a stored opt-out", async () => {
        const { service, emailProvider } = makeService({ stored: [{ orgMemberId: "admin", type: "AMBASSADOR_APPLICATION_SUBMITTED", email: false }] });
        await notify(service);
        expect(recipients(emailProvider)).toEqual(["owner@x.com"]);
    });

    it("keeps sending when one address fails, and never throws", async () => {
        const { service, emailProvider } = makeService({ failFor: "owner@x.com" });
        await expect(notify(service)).resolves.toBeUndefined();
        expect(recipients(emailProvider)).toEqual(["admin@x.com", "owner@x.com"]);
    });

    it("feature flag off: no email, no preference exposed, update 404s", async () => {
        const { service, emailProvider, notificationRepo } = makeService({ flagOn: false });
        await notify(service);
        expect(emailProvider.enqueueMessage).not.toHaveBeenCalled();
        expect(await service.getPreferences("org1", "a-owner")).toEqual([]);
        await expect(service.updatePreferences("org1", "a-owner", [{ type: "AMBASSADOR_APPLICATION_SUBMITTED", email: false }])).rejects.toThrow("Not found");
        expect(notificationRepo.upsertPreferences).not.toHaveBeenCalled();
    });

    it("preferences: default for owner, hidden for viewer, unknown type rejected", async () => {
        const { service } = makeService();
        expect(await service.getPreferences("org1", "a-owner")).toEqual([expect.objectContaining({ type: "AMBASSADOR_APPLICATION_SUBMITTED", email: true })]);
        expect(await service.getPreferences("org1", "a-viewer")).toEqual([]);
        await expect(service.updatePreferences("org1", "a-owner", [{ type: "NOPE", email: true }])).rejects.toThrow("Not found");
    });
});
