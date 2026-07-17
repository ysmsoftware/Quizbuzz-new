export const USE_CASES = [
  { value: 'EDUCATIONAL_INSTITUTION', label: 'Educational Institution' },
  { value: 'COACHING_INSTITUTE',      label: 'Coaching Institute' },
  { value: 'CORPORATE_TRAINING',      label: 'Corporate Training' },
  { value: 'RECRUITMENT_ASSESSMENT',  label: 'Recruitment & Assessment' },
  { value: 'INDIVIDUAL_EDUCATOR',     label: 'Individual Educator' },
  { value: 'COMMUNITY_CLUB',          label: 'Community / Club' },
  { value: 'PERSONAL',                label: 'Personal / Learning' },
  { value: 'OTHER',                   label: 'Other' },
] as const;

export const ORG_SIZES = [
  { value: 'SIZE_1',        label: 'Just me' },
  { value: 'SIZE_2_10',     label: '2 – 10' },
  { value: 'SIZE_11_50',    label: '11 – 50' },
  { value: 'SIZE_51_200',   label: '51 – 200' },
  { value: 'SIZE_200_PLUS', label: '200+' },
] as const;

export const CONTEST_VOLUMES = [
  { value: 'RANGE_1_4',     label: '1 – 4 / month' },
  { value: 'RANGE_5_20',    label: '5 – 20 / month' },
  { value: 'RANGE_20_PLUS', label: 'More than 20' },
  { value: 'UNSURE',        label: 'Not sure yet' },
] as const;

export const PARTICIPANT_VOLUMES = [
  { value: 'RANGE_UNDER_100', label: 'Under 100' },
  { value: 'RANGE_100_500',   label: '100 – 500' },
  { value: 'RANGE_500_2000',  label: '500 – 2,000' },
  { value: 'RANGE_2000_PLUS', label: '2,000+' },
  { value: 'UNSURE',          label: 'Not sure yet' },
] as const;

export const HEARD_SOURCES = [
  { value: 'GOOGLE_SEARCH',    label: 'Google Search' },
  { value: 'SOCIAL_MEDIA',     label: 'Social Media' },
  { value: 'LINKEDIN',         label: 'LinkedIn' },
  { value: 'WORD_OF_MOUTH',    label: 'Word of Mouth' },
  { value: 'REFERRAL',         label: 'Referral' },
  { value: 'ADVERTISEMENT',    label: 'Advertisement' },
  { value: 'EVENT_CONFERENCE', label: 'Event / Conference' },
  { value: 'OTHER',            label: 'Other' },
] as const;
