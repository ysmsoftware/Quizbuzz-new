import { Contest, ServerContest } from '@/lib/types';

export {
  deriveContestPhase,
  getServerContestStatus,
  isContestLive,
} from '@/lib/serverContestStatus';

/**
 * Transforms a ServerContest from the backend API into the local Contest shape
 * to ensure that all UI views continue to function without massive refactoring.
 */
/**
 * Fields the backend's UpdateContestSchema actually accepts.
 *
 * The client-side `Contest` type is a superset of the real model — several fields
 * (totalMarks, passingMarks, negativeMarking, tabSwitchLimit, allowBackNavigation,
 * category, difficulty, topic, fee, shortDescription…) are synthesised below from
 * constants or derived values and have no column on Contest. Sending them to
 * PATCH /contests/:id now fails validation, because the schema is `.strict()` and
 * rejects unknown keys rather than silently discarding them.
 */
const PERSISTABLE_CONTEST_FIELDS = new Set([
  'title',
  'description',
  'details',
  'bannerImage',
  'topics',
  'rules',
  'paymentEnabled',
  'paymentConfig',
  'duration',
  'durationMinutes',
  'cutoffScore',
  'maxParticipants',
  'registrationDeadline',
  'startTime',
  'shuffleQuestions',
  'shuffleOptions',
  'proctoringEnabled',
  'showResultsAfter',
  'defaultQuestionMarks',
  'defaultQuestionNegativeMark',
  'prizes',
]);

/**
 * Split an edit payload into what the API can store and what it cannot, so callers can
 * persist the former and tell the user the truth about the latter — rather than either
 * 400-ing the whole request or silently dropping fields and reporting success.
 */
export function splitPersistableContestFields(
  updates: Record<string, unknown>,
): { persisted: Record<string, unknown>; dropped: string[] } {
  const persisted: Record<string, unknown> = {};
  const dropped: string[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (PERSISTABLE_CONTEST_FIELDS.has(key)) persisted[key] = value;
    else dropped.push(key);
  }

  return { persisted, dropped };
}

export function adaptServerContest(server: ServerContest): Contest {
  const _count = (server as any)._count || {};
  
  // Map Server status to local ContestStatus: 'draft' | 'published' | 'active' | 'completed' | 'cancelled'
  let mappedStatus: Contest['status'] = 'draft';
  const statusStr = server.status?.toUpperCase() || 'DRAFT';
  
  if (statusStr === 'DRAFT') {
    mappedStatus = 'draft';
  } else if (['PUBLISHED', 'REGISTRATION_CLOSED'].includes(statusStr)) {
    mappedStatus = 'published';
  } else if (statusStr === 'LIVE') {
    mappedStatus = 'active';
  } else if (['EVALUATION', 'RESULTS_OUT', 'COMPLETED'].includes(statusStr)) {
    mappedStatus = 'completed';
  } else if (statusStr === 'CANCELLED') {
    mappedStatus = 'cancelled';
  }

  // Construct prizes
  const prizes = (server.prizes || []).map(p => {
    return {
      rank: `${p.rankFrom}-${p.rankTo}`,
      title: p.label || '',
      amount: Number(p.amount) || 0,
      description: p.benefits?.join(', ') || '',
    };
  });

  return {
    id: server.id,
    title: server.title,
    slug: server.slug,
    serverStatus: server.status,
    orgId: '',
    orgSlug: '',
    description: server.description || '',
    details: server.details || '',
    shortDescription: server.description?.slice(0, 120) || '',
    topic: server.topics?.[0] || 'General',
    tags: server.topics || [],
    category: server.topics?.[0] || 'General',
    difficulty: 'medium',
    status: mappedStatus,
    coverImage: server.bannerImage || undefined,
    bannerImage: server.bannerImage || undefined,
    thumbnailImage: server.bannerImage || undefined,

    // Timing
    startTime: server.startTime,
    manualStartVisibleFrom: server.manualStartVisibleFrom,
    registrationDeadline: server.registrationDeadline,
    registrationStartDate: server.createdAt,
    registrationEndDate: server.registrationDeadline,
    contestDate: server.startTime ? server.startTime.split('T')[0] : '',
    contestStartTime: server.startTime,
    contestEndTime: server.endTime || (server.startTime ? new Date(new Date(server.startTime).getTime() + server.duration * 60000).toISOString() : ''),
    durationMinutes: server.duration || 0,
    timezone: 'UTC',

    // Configuration
    totalQuestions: _count.questions || 0,
    totalMarks: (_count.questions || 0) * 2, // arbitrary default
    passingMarks: server.cutoffScore ? Math.round((server.cutoffScore / 100) * ((_count.questions || 0) * 2)) : 0,
    cutoffScore: server.cutoffScore,
    showResultsAfter: server.showResultsAfter,
    negativeMarking: false,
    negativeMarkValue: 0,
    shuffleQuestions: server.shuffleQuestions,
    shuffleOptions: server.shuffleOptions,
    allowBackNavigation: true,
    // Was hardcoded `false`, which silently contradicted the server — Contest.proctoringEnabled
    // is a real column (defaults true). Admin screens reading this were shown the wrong
    // proctoring state for every contest.
    proctoringEnabled: server.proctoringEnabled ?? true,
    fullscreenRequired: false,
    webcamRequired: false,
    tabSwitchLimit: 3,

    paymentEnabled: server.paymentEnabled,
    paymentConfig: server.paymentConfig,
    // Contest.paymentConfig.amount is stored in rupees, not paise — unlike the
    // separate Payment.amount transaction record, which genuinely is paise for
    // Razorpay. The backend's own order creation confirms this (payment.service.ts
    // does `paymentConfig.amount * 100` right before calling Razorpay), as does the
    // admin create form, which is labelled "Fee Amount (₹)" and sends the raw value.
    // No conversion here — dividing by 100 was turning a ₹1 fee into ₹0.01.
    fee: server.paymentConfig?.amount ?? 0,
    currency: server.paymentConfig?.currency || 'INR',
    registrationFee: server.paymentConfig?.amount ?? 0,
    maxParticipants: server.maxParticipants || 0,
    currentParticipants: _count.participants || 0,

    // Content
    rules: server.rules || [],
    prizes,
    registrationFields: [],

    // Lifecycle
    publishedAt: server.status !== 'DRAFT' ? server.createdAt : null,
    cancelledAt: server.status === 'CANCELLED' ? server.updatedAt : null,
    resultsPublishedAt: ['RESULTS_OUT', 'COMPLETED'].includes(server.status) ? server.updatedAt : null,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
    organizerId: '',
    joinCode: server.joinCode,

    // Scoring defaults
    defaultQuestionMarks: server.defaultQuestionMarks ?? 1,
    defaultQuestionNegativeMark: Number(server.defaultQuestionNegativeMark ?? 0.5),

    _count: {
      questions: _count.questions || 0,
      participants: _count.participants || 0,
      submissions: _count.submissions || 0,
      payments: _count.payments || 0,
    }
  };
}
