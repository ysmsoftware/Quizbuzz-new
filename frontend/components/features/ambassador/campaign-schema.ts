import { z } from 'zod';

const numberField = (label: string) =>
  z.number({ invalid_type_error: `${label} must be a number` });

const milestoneTierSchema = z
  .object({
    label: z.string().optional(),
    minRegistrations: numberField('Min registrations').min(0, 'Must be 0 or more'),
    maxRegistrations: numberField('Max registrations').nullable(),
    rewardType: z.enum(['PER_REGISTRATION', 'FLAT_PLUS_PER_REG']),
    amountPerRegistration: numberField('Amount').positive('Must be greater than 0'),
    goodie: z.object({ label: z.string(), cashEquivalent: z.number().optional() }).optional(),
  })
  .refine((tier) => tier.maxRegistrations === null || tier.maxRegistrations > tier.minRegistrations, {
    message: 'Max must be greater than min',
    path: ['maxRegistrations'],
  });

const speedBonusTierSchema = z.object({
  withinDays: numberField('Within days').positive('Must be greater than 0'),
  bonusAmount: numberField('Bonus amount').positive('Must be greater than 0'),
  label: z.string().min(1, 'Label is required'),
  maxWinners: z.number().optional(),
  goodie: z.object({ label: z.string(), cashEquivalent: z.number().optional() }).optional(),
});

const speedBonusSchema = z
  .object({
    enabled: z.boolean(),
    campaignStartAt: z.string(),
    milestoneThreshold: z.number(),
    tiers: z.array(speedBonusTierSchema),
  })
  .superRefine((speedBonus, ctx) => {
    if (!speedBonus.enabled) return;
    if (!speedBonus.campaignStartAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Campaign start date is required', path: ['campaignStartAt'] });
    }
    if (!(speedBonus.milestoneThreshold > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be greater than 0', path: ['milestoneThreshold'] });
    }
    if (speedBonus.tiers.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Add at least one bonus tier', path: ['tiers'] });
    }
  });

const leaderboardRankSchema = z
  .object({
    rank: z.number().optional(),
    rankRange: z.tuple([z.number(), z.number()]).optional(),
    cashAmount: z.number().optional(),
    goodie: z.object({ label: z.string(), cashEquivalent: z.number().optional() }).optional(),
    label: z.string().optional(),
  })
  .refine((rank) => rank.rank !== undefined || rank.rankRange !== undefined, {
    message: 'Rank is required',
    path: ['rank'],
  })
  .refine((rank) => rank.cashAmount !== undefined || rank.goodie !== undefined || !!rank.label, {
    message: 'Add a cash amount, goodie, or label',
    path: ['cashAmount'],
  });

const leaderboardScopeSchema = z
  .object({
    kind: z.enum(['INDIVIDUAL_AMBASSADOR', 'APPLICATION_FIELD_GROUP']),
    groupByFieldKeys: z.array(z.string().min(1)).min(1).max(3).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'APPLICATION_FIELD_GROUP' && (!data.groupByFieldKeys || data.groupByFieldKeys.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select at least one field to group by.', path: ['groupByFieldKeys'] });
    }
  });

const leaderboardCutSchema = z.object({
  scope: leaderboardScopeSchema,
  label: z.string().min(1, 'Label is required'),
  rankedBy: z.literal('REGISTRATION_RATE_PERCENT').optional(),
  winnerCount: z.number().optional(),
  ranks: z.array(leaderboardRankSchema).min(1, 'Add at least one rank reward'),
  consolation: z.object({ label: z.string(), cashAmount: z.number() }).optional(),
});

export const campaignFormSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(200, 'Keep it under 200 characters'),
  contestId: z.string().min(1, 'Select a contest'),
  ambassadorTypesAllowed: z.array(z.string()).min(1, 'Select at least one ambassador type'),
  rewardConfig: z.object({
    currency: z.string(),
    milestoneTiers: z.array(milestoneTierSchema).min(1, 'Add at least one milestone tier'),
    speedBonus: speedBonusSchema.optional(),
    leaderboardPrizes: z.array(leaderboardCutSchema),
  }),
  shareTemplates: z.object({
    whatsappText: z.string().optional(),
    instagramText: z.string().optional(),
    posterImageUrl: z.string().optional(),
  }),
});

export type FieldErrorMap = Record<string, string>;

/** Converts zod's issue list into a flat dot-path -> message map, e.g. "rewardConfig.milestoneTiers.0.amountPerRegistration". */
export function zodIssuesToErrorMap(issues: z.ZodIssue[]): FieldErrorMap {
  const map: FieldErrorMap = {};
  for (const issue of issues) {
    const path = issue.path.join('.');
    if (!map[path]) map[path] = issue.message;
  }
  return map;
}

/** Converts apiClient's ApiError.details (Record<string, string[]>) into the same flat map, taking the first message per field. */
export function detailsToErrorMap(details: Record<string, string[]>): FieldErrorMap {
  const map: FieldErrorMap = {};
  for (const [path, messages] of Object.entries(details)) {
    if (messages?.[0]) map[path] = messages[0];
  }
  return map;
}
