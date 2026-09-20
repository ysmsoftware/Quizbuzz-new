import { AmbassadorCampaignStatus } from "@prisma/client";
import { editableFieldsFor } from "./ambassador-campaign.validator";

describe("editableFieldsFor rewardConfig lock", () => {
    it("stays editable while LIVE so a running campaign can change prizes", () => {
        expect(editableFieldsFor(AmbassadorCampaignStatus.LIVE).has("rewardConfig")).toBe(true);
    });

    it("locks once the campaign has ended or is archived", () => {
        expect(editableFieldsFor(AmbassadorCampaignStatus.ENDED).has("rewardConfig")).toBe(false);
        expect(editableFieldsFor(AmbassadorCampaignStatus.ARCHIVED).has("rewardConfig")).toBe(false);
    });
});
