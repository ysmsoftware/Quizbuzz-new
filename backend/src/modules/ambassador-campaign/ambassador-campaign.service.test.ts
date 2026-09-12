import { AmbassadorCampaignService } from "./ambassador-campaign.service";
import { AmbassadorCampaignRepository } from "./ambassador-campaign.repository";

// Regression lock for the "template amounts double-divided into paise" bug: instantiateTemplate
// must persist the template's raw (still-paise) rewardConfig into the new campaign row, not the
// rupees-converted response shape — otherwise the next normal fetch of that campaign divides an
// already-in-rupees number by 100 again.
describe("AmbassadorCampaignService.instantiateTemplate — currency round-trip", () => {
    const template = {
        id: "tmpl1",
        organizationId: "org1",
        name: "Template A",
        ambassadorTypesAllowed: ["STUDENT"],
        rewardConfig: { milestoneTiers: [{ minRegistrations: 1, maxRegistrations: 40, rewardType: "PER_REGISTRATION", amountPerRegistration: 1500 }] }, // 1500 paise = ₹15
        shareTemplates: {},
        groups: [],
        sourceCampaignId: null,
        createdById: "user1",
        createdAt: new Date(),
    };

    function makeService() {
        const created: { rewardConfig: unknown }[] = [];
        const campaignRepo = {
            findTemplateById: jest.fn().mockResolvedValue(template),
            findByContestId: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((data) => {
                created.push(data);
                return Promise.resolve({ id: "camp1", ...data });
            }),
            replaceGroups: jest.fn().mockResolvedValue(undefined),
            // Simulates a DB round-trip: hands back exactly the (still-paise) row create() wrote.
            findById: jest.fn().mockImplementation(() =>
                Promise.resolve({
                    id: "camp1",
                    organizationId: "org1",
                    contestId: null,
                    name: "Template A",
                    ambassadorTypesAllowed: ["STUDENT"],
                    rewardConfig: created[0]!.rewardConfig,
                    shareTemplates: {},
                    sourceCampaignId: "tmpl1",
                    status: "DRAFT",
                    wizardStep: 1,
                    startDate: null,
                    endDate: null,
                    phases: [],
                    phaseTemplate: null,
                    publishedAt: null,
                    createdById: "user1",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
            ),
        } as unknown as AmbassadorCampaignRepository;

        const service = new AmbassadorCampaignService(campaignRepo, {} as any, {} as any, {} as any, {} as any);
        return { service, campaignRepo };
    }

    it("persists the template's raw paise amounts, not the rupees-converted ones", async () => {
        const { service, campaignRepo } = makeService();
        await service.instantiateTemplate("org1", "user1", "tmpl1", {});

        const createCall = (campaignRepo.create as jest.Mock).mock.calls[0][0];
        expect(createCall.rewardConfig.milestoneTiers[0].amountPerRegistration).toBe(1500); // still paise
    });

    it("returns the new campaign with amounts correctly converted exactly once", async () => {
        const { service } = makeService();
        const result = await service.instantiateTemplate("org1", "user1", "tmpl1", {});
        expect(result.rewardConfig.milestoneTiers?.[0]?.amountPerRegistration).toBe(15); // ₹15, not ₹0.15
    });
});
