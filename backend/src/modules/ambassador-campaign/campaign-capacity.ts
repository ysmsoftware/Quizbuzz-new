import { AmbassadorGroupInput, CampaignCapacity } from "./ambassador-campaign.types";

/**
 * Pure aggregation over a campaign's Ambassador Structure rows — same "walk the array
 * generically" spirit as reward-calculator.ts (§6.4): never special-cases a group count,
 * groupType, or target number. Used identically by the wizard's live preview (via the
 * groups endpoint response) and the management dashboard's Structure tab.
 */
export function calculateCampaignCapacity(groups: Pick<AmbassadorGroupInput, "ambassadorTarget" | "registrationTarget">[]): CampaignCapacity {
    return groups.reduce<CampaignCapacity>(
        (acc, g) => {
            const ambassadors = g.ambassadorTarget ?? 0;
            const perAmbassador = g.registrationTarget ?? 0;
            return {
                groupCount: acc.groupCount + 1,
                totalAmbassadorTarget: acc.totalAmbassadorTarget + ambassadors,
                totalRegistrationTarget: acc.totalRegistrationTarget + ambassadors * perAmbassador,
            };
        },
        { groupCount: 0, totalAmbassadorTarget: 0, totalRegistrationTarget: 0 },
    );
}
