import type { AmbassadorCampaignStatus } from '@/lib/types/ambassador';

export const CAMPAIGN_STATUS_BADGE_VARIANT: Record<AmbassadorCampaignStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'outline',
  PUBLISHED: 'secondary',
  LIVE: 'default',
  ENDED: 'secondary',
  ARCHIVED: 'secondary',
};
