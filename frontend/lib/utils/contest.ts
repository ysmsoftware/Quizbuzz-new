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
    const pAmt = Number((p as any).amount || parseFloat(p.prize) || 0);
    const pLabel = (p as any).label || p.prize || '';
    return {
      rank: `${p.rankFrom}-${p.rankTo}`,
      title: pLabel,
      amount: pAmt,
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
    shortDescription: server.description?.slice(0, 120) || '',
    topic: server.topics?.[0] || 'General',
    tags: server.topics || [],
    category: server.topics?.[0] || 'General',
    difficulty: 'medium',
    status: mappedStatus,
    coverImage: undefined,
    bannerImage: undefined,
    thumbnailImage: undefined,

    // Timing
    startTime: server.startTime,
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
    negativeMarking: false,
    negativeMarkValue: 0,
    shuffleQuestions: server.shuffleQuestions,
    shuffleOptions: server.shuffleOptions,
    allowBackNavigation: true,
    proctoringEnabled: false,
    fullscreenRequired: false,
    webcamRequired: false,
    tabSwitchLimit: 3,

    // paymentConfig.amount is stored in paise (smallest unit) — divide by 100 for rupees
    fee: server.paymentConfig?.amount ? server.paymentConfig.amount / 100 : 0,
    currency: server.paymentConfig?.currency || 'INR',
    registrationFee: server.paymentConfig?.amount ? server.paymentConfig.amount / 100 : 0,
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

    _count: {
      questions: _count.questions || 0,
      participants: _count.participants || 0,
      submissions: _count.submissions || 0,
      payments: _count.payments || 0,
    }
  };
}
