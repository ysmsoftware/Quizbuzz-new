import type { AvailableCampaignItem } from '@/lib/types/ambassador';
import type { Campaign } from './types';

function orgInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const initials = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
    return initials || 'QB';
}

function rewardRange(campaign: AvailableCampaignItem): { min: number; max?: number } {
    const rates = (campaign.rewardConfig.milestoneTiers ?? []).map((t) => t.amountPerRegistration);
    if (rates.length === 0) return { min: 0 };
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    return max === min ? { min } : { min, max };
}

function daysLeft(campaign: AvailableCampaignItem): number {
    if (!campaign.endDate) return 0;
    return Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

/** Maps a real backend campaign into the local `Campaign` shape the copied marketplace
 *  UI expects. Fields with no public-API equivalent (participantsTarget, registeredSoFar,
 *  aboutContest, etc.) are left blank/zeroed rather than fabricated — CampaignMarketplace
 *  no longer renders them. */
export function mapAvailableCampaignToLocal(
    campaign: AvailableCampaignItem,
    typeLabel: (key: string) => string,
): Campaign {
    const { min, max } = rewardRange(campaign);
    const days = daysLeft(campaign);
    return {
        id: campaign.id,
        organization: campaign.organizationName,
        orgInitials: orgInitials(campaign.organizationName),
        name: campaign.name,
        promotedContest: campaign.contestTitle,
        category: 'General',
        eligibleRoles: campaign.ambassadorTypesAllowed.map(typeLabel),
        rewardMin: min,
        rewardMax: max,
        rewardUnit: 'per registration',
        rewardDetails: '',
        daysLeft: days,
        status: days <= 3 ? 'Closing soon' : 'Accepting applications',
        participantsTarget: 0,
        registeredSoFar: 0,
        aboutContest: '',
        audienceFit: '',
        payoutTerms: '',
        sharingToolsProvided: [],
        referralSlug: campaign.id,
    };
}
