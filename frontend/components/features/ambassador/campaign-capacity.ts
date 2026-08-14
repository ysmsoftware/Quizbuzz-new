import type { AmbassadorGroupInput, CampaignCapacity } from '@/lib/types/ambassador';

/** Mirrors the backend's calculateCampaignCapacity (campaign-capacity.ts) — used for the
 *  wizard's live preview before anything has been saved, so it doesn't need a round trip. */
export function calculateCampaignCapacity(groups: Pick<AmbassadorGroupInput, 'ambassadorTarget' | 'registrationTarget'>[]): CampaignCapacity {
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
