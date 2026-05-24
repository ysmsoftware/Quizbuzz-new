import { get, post, patch, ApiResponse } from './apiClient';

interface SubmissionSummary {
  totalSubmitted: number;
  totalEvaluated: number;
  totalPending: number;
  averageScore: string;
  highestScore: string;
  lowestScore: string;
}

interface SubmissionRecord {
  id: string;
  participantId: string;
  registrationRef?: string;
  contactName?: string;
  contactEmail?: string;
  status: 'PENDING' | 'SUBMITTED' | 'EVALUATED' | 'INVALIDATED';
  source?: string;
  score: number | string;
  percentage: number | string;
  isPassed?: boolean | null;
  timeTakenSecs?: number;
  submittedAt: string;
  evaluatedAt?: string;
  totalQuestions?: number;
  attempted?: number;
  participant?: {
    contact: {
      firstName: string;
      lastName: string;
      email: string;
    }
  }
}

interface SubmissionsResponse {
  data: SubmissionRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  summary: SubmissionSummary;
}

/**
 * Submissions API
 */
export const submissionsApi = {
  getContestSubmissions: (contestId: string, params?: { status?: string; page?: number; limit?: number }) =>
    get<SubmissionsResponse>(`/admin/contests/${contestId}/submissions`, { params }),

  getContestSubmissionsStats: (contestId: string) =>
    get<any>(`/admin/contests/${contestId}/submissions/stats`),

  getSubmissionDetail: (submissionId: string) =>
    get<any>(`/admin/submissions/${submissionId}`),

  invalidateSubmission: (submissionId: string, reason: string) =>
    patch<any>(`/admin/submissions/${submissionId}/invalidate`, { reason }),
  
  bulkEvaluate: (contestId: string) =>
    post<any>(`/admin/contests/${contestId}/submissions/evaluate`),
};

/**
 * Analytics API
 */
export const analyticsApi = {
  getContestAnalytics: (contestId: string) =>
    get<any>(`/analytics/${contestId}`),

  getScoreDistribution: (contestId: string) =>
    get<any>(`/analytics/${contestId}/score-distribution`),

  refreshAnalytics: (contestId: string) =>
    post<any>(`/analytics/${contestId}/refresh`),
};

/**
 * Proctoring API
 */
export const proctoringApi = {
  getOverview: (contestId: string) =>
    get<any>(`/proctoring/contests/${contestId}/overview`),

  getFlaggedParticipants: (contestId: string, params?: { page?: number; limit?: number }) =>
    get<any>(`/proctoring/contests/${contestId}/flagged`, { params }),

  getParticipantEvents: (contestId: string, participantId: string, params?: { page?: number; limit?: number }) =>
    get<any>(`/proctoring/contests/${contestId}/participants/${participantId}/events`, { params }),

  dismissViolation: (scoreId: string) =>
    patch<any>(`/proctoring/scores/${scoreId}/status`, { isDismissed: true }),
};
