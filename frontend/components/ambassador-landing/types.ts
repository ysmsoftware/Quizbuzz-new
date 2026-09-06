export type AmbassadorRole = 'Student Ambassador' | 'Faculty Ambassador' | 'General Ambassador';

export interface Campaign {
  id: string;
  organization: string;
  orgInitials: string;
  name: string;
  promotedContest: string;
  category: 'Aptitude' | 'Coding' | 'Commerce' | 'Technical' | 'Academic' | 'General';
  eligibleRoles: string[];
  rewardMin: number;
  rewardMax?: number;
  rewardUnit: string;
  rewardDetails: string;
  daysLeft: number;
  status: 'Accepting applications' | 'Closing soon' | 'High demand';
  participantsTarget: number;
  registeredSoFar: number;
  aboutContest: string;
  audienceFit: string;
  payoutTerms: string;
  sharingToolsProvided: string[];
  referralSlug: string;
  contestSlug?: string;
  ogImage?: string;
}

export interface FunnelStage {
  id: string;
  label: string;
  description: string;
  count: number;
  metricLabel: string;
}

export interface MilestoneTier {
  level: number;
  name: string;
  registrationsRequired: number;
  rewardRate: string;
  bonus: string;
  badge: string;
  unlocked: boolean;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'Program' | 'Attribution & Tracking' | 'Rewards & Payout' | 'Rules & Guidelines';
}

export interface TestimonialStory {
  id: string;
  name: string;
  role: AmbassadorRole;
  collegeOrCommunity: string;
  avatarSeed: string;
  quote: string;
  stats: {
    registrations: number;
    earned: number;
    campaigns: number;
  };
}
